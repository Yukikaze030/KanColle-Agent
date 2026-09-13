/**
 * Dump full HTML + extract 带路条件/敌方配置 for one map via CDP.
 * Usage: node scripts/dump-map-source.mjs 1-1
 * Output: data/kancolle-maps/html/<id>.html, data/kancolle-maps/raw/<id>.txt, data/kancolle-maps/meta/<id>.json
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const mapId = process.argv[2];
if (!mapId) throw new Error("map id required");
const port = Number(process.env.CDP_PORT || 9333);
const tid = "23451223";
const root = join(process.cwd(), "data", "kancolle-maps");
mkdirSync(join(root, "html"), { recursive: true });
mkdirSync(join(root, "raw"), { recursive: true });
mkdirSync(join(root, "meta"), { recursive: true });

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
      if(t.startsWith(id)&&/pid=/.test(h)) return {t,h};
    }
    return null})()`,
  returnByValue: true,
});
if (!link.result?.value) {
  console.log(JSON.stringify({ mapId, error: "no pid" }));
  ws.close();
  process.exit(1);
}

await send("Page.navigate", { url: link.result.value.h });
await sleep(3200);
await guestJump();

await send("Runtime.evaluate", {
  expression: `(()=>{for(const b of document.querySelectorAll('button[name="collapseSwitchButton"]')){try{b.click()}catch(e){}}
    for(const c of document.querySelectorAll('.collapse_content')){ if(c.style&&c.style.display==='none'&&c.innerText.trim()) c.style.display=''; }
    return 1})()`,
  returnByValue: true,
});
await sleep(4000);

// second expand pass
await send("Runtime.evaluate", {
  expression: `(()=>{for(const b of document.querySelectorAll('button[name="collapseSwitchButton"]')){
    try{ if(!(b.parentElement?.nextElementSibling?.innerText||'').trim()) b.click(); }catch(e){}
  } return 1})()`,
  returnByValue: true,
});
await sleep(2500);

const dump = await send("Runtime.evaluate", {
  expression: `(()=>{
    const roots=[...document.querySelectorAll('.postcontent,.postbody')];
    const root=roots[0]||document.body;
    const text=root.innerText||'';
    const html=root.innerHTML||'';
    function sliceSection(key, stopKeys){
      const i=text.indexOf(key);
      if(i<0) return null;
      let s=text.slice(i);
      for(const sk of stopKeys){
        const j=s.indexOf('\\n'+sk, 20);
        if(j>40){ s=s.slice(0,j); break; }
      }
      return s.trim();
    }
    const routing=sliceSection('带路条件',['推荐编成','攻击机安全','常用的攻略阵容','敌方详细','地图(新窗口)']);
    const enemy=sliceSection('敌方详细配置',['带路条件','推荐编成','攻击机安全','常用的攻略阵容']);
    const analysis=sliceSection('地图分析',['带路条件','敌方详细','推荐编成']);
    return {
      title: document.title,
      url: location.href,
      text,
      html,
      routing: routing||'',
      enemy: enemy||'',
      analysis: analysis||'',
      hasRouting: !!routing,
      hasEnemy: !!enemy,
      textLen: text.length,
      htmlLen: html.length,
    };
  })()`,
  returnByValue: true,
});

const data = dump.result?.value || {};
writeFileSync(join(root, "html", `${mapId}.html`), data.html || "", "utf8");
writeFileSync(join(root, "raw", `${mapId}.txt`), data.text || "", "utf8");
const meta = {
  map_id: mapId,
  source_url: link.result.value.h,
  source_title: link.result.value.t,
  era: "2",
  tid,
  fetched_at: new Date().toISOString(),
  has_routing: Boolean(data.hasRouting),
  has_enemy: Boolean(data.hasEnemy),
  routing_chars: (data.routing || "").length,
  enemy_chars: (data.enemy || "").length,
  text_len: data.textLen,
  html_len: data.htmlLen,
  routing: data.routing || "",
  enemy: data.enemy || "",
  analysis: data.analysis || "",
};
writeFileSync(join(root, "meta", `${mapId}.json`), JSON.stringify(meta, null, 2), "utf8");
console.log(
  JSON.stringify({
    mapId,
    url: link.result.value.h,
    hasRouting: meta.has_routing,
    hasEnemy: meta.has_enemy,
    routingChars: meta.routing_chars,
    enemyChars: meta.enemy_chars,
    htmlLen: meta.html_len,
  }),
);
ws.close();
