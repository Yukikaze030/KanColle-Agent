/**
 * Extract 带路条件 blocks from NGA map floors via CDP (one map id from argv).
 * Usage: node scripts/fetch-nga-routing-one.mjs 1-1
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const mapId = process.argv[2];
if (!mapId) throw new Error("map id required e.g. 1-1");
const port = Number(process.env.CDP_PORT || 9333);
const tid = "23451223";
const outDir = join(
  process.cwd(),
  ".opencode/skills/fleet-builder/refs/maps",
  "_routing",
);
mkdirSync(outDir, { recursive: true });

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const target = targets.find((t) => t.type === "page") || targets[0];
if (!target) throw new Error("no page");

const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");

async function guestJump() {
  const t = await send("Runtime.evaluate", {
    expression: "document.title",
    returnByValue: true,
  });
  if (/访客不能直接访问/.test(t.result?.value || "")) {
    await send("Runtime.evaluate", {
      expression: `(()=>{const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||''));if(a)a.click();return !!a})()`,
      returnByValue: true,
    });
    await sleep(3500);
  }
}

await send("Page.navigate", { url: `https://bbs.nga.cn/read.php?tid=${tid}` });
await sleep(2800);
await guestJump();

const link = await send("Runtime.evaluate", {
  expression: `(()=>{const id=${JSON.stringify(mapId)};
    for(const a of document.querySelectorAll('a')){
      const t=(a.innerText||'').trim();
      const h=a.href||'';
      if(t.startsWith(id) && /pid=/.test(h)) return {t,h};
    }
    return null})()`,
  returnByValue: true,
});
if (!link.result?.value) {
  writeFileSync(join(outDir, `${mapId}.json`), JSON.stringify({ mapId, error: "no pid link" }), "utf8");
  console.log(JSON.stringify({ mapId, error: "no pid link" }));
  ws.close();
  process.exit(0);
}

await send("Page.navigate", { url: link.result.value.h });
await sleep(3000);
await guestJump();

// Expand all collapse buttons, especially 带路条件
const expand = await send("Runtime.evaluate", {
  expression: `(()=>{
    const clicked=[];
    for(const b of document.querySelectorAll('button[name="collapseSwitchButton"]')){
      const label=(b.parentElement?.innerText||b.innerText||'').slice(0,40);
      try{ b.click(); clicked.push(label); }catch(e){}
    }
    return clicked;
  })()`,
  returnByValue: true,
});
await sleep(3500);

// Second expand pass + force show hidden collapse_content
await send("Runtime.evaluate", {
  expression: `(()=>{
    for(const b of document.querySelectorAll('button[name="collapseSwitchButton"]')){
      try{ if(!(b.parentElement?.nextElementSibling?.innerText||'').trim()) b.click(); }catch(e){}
    }
    for(const c of document.querySelectorAll('.collapse_content')){
      if(c.style && c.style.display==='none' && c.innerText.trim()) c.style.display='';
    }
    return 1;
  })()`,
  returnByValue: true,
});
await sleep(2000);

const dump = await send("Runtime.evaluate", {
  expression: `(()=>{
    const roots=[...document.querySelectorAll('.postcontent,.postbody')];
    const root=roots[0]||document.body;
    const text=root.innerText||'';
    const html=root.innerHTML||'';
    // extract 带路条件 section if present
    const idx=text.indexOf('带路条件');
    let routing=text;
    if(idx>=0){
      routing=text.slice(idx);
      // cut at next major section
      const cut=routing.search(/\\n\\s*(推荐编成|攻击机安全|常用的攻略阵容|敌方详细|地图\\(新窗口\\))/);
      if(cut>50) routing=routing.slice(0,cut);
    }
    return {
      title: document.title,
      url: location.href,
      hasRouting: idx>=0,
      routingChars: routing.length,
      routing,
      fullChars: text.length,
    };
  })()`,
  returnByValue: true,
});

const data = dump.result?.value || {};
writeFileSync(
  join(outDir, `${mapId}.json`),
  JSON.stringify(
    {
      mapId,
      source: link.result.value.h,
      source_title: link.result.value.t,
      hasRouting: data.hasRouting,
      routingChars: data.routingChars,
      routing: data.routing,
      expanded: (expand.result?.value || []).length,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(
  JSON.stringify({
    mapId,
    url: link.result.value.h,
    hasRouting: data.hasRouting,
    routingChars: data.routingChars,
    preview: (data.routing || "").replace(/\s+/g, " ").slice(0, 200),
  }),
);
ws.close();
