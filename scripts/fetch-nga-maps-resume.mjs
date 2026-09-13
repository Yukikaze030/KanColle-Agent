/**
 * Resume NGA map post fetch; skip maps already saved with enough text.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const tid = process.argv[2] || "23451223";
const port = Number(process.env.CDP_PORT || 9333);
const mapsDir = join(process.cwd(), ".opencode", "skills", "fleet-builder", "refs", "maps");
const MIN_CHARS = 1200;

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const target =
  targets.find((t) => t.type === "page" && t.url.includes(String(tid))) ||
  targets.find((t) => t.type === "page") ||
  targets[0];
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

async function ensurePost() {
  const t = await send("Runtime.evaluate", {
    expression: "document.title",
    returnByValue: true,
  });
  if (/访客不能直接访问/.test(t.result?.value || "")) {
    await send("Runtime.evaluate", {
      expression: `(() => { const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||'')); if(a)a.click(); return !!a; })()`,
      returnByValue: true,
    });
    await sleep(3500);
  }
}

// get TOC from main thread page
if (!target.url.includes(`tid=${tid}`) && !target.url.includes("page=")) {
  await send("Page.navigate", { url: `https://bbs.nga.cn/read.php?tid=${tid}` });
  await sleep(3000);
  await ensurePost();
}

const linksRes = await send("Runtime.evaluate", {
  expression: `(() => {
    const out=[]; const seen=new Set();
    for (const a of document.querySelectorAll('a')) {
      const t=(a.innerText||'').trim();
      const href=a.href||'';
      const m=t.match(/^([1-7]-[1-6])\\s*(.*)$/);
      if(!m) continue;
      const id=m[1];
      if(seen.has(id)) continue;
      if(!/read\\.php\\?pid=/.test(href)) continue;
      seen.add(id);
      out.push({id, name:(m[2]||'').replace(/R$/,'').trim(), href});
    }
    return out;
  })()`,
  returnByValue: true,
});
const links = linksRes.result?.value || [];
console.log("links", links.length);

const todo = [];
for (const link of links) {
  const file = join(mapsDir, `${link.id}.md`);
  if (existsSync(file)) {
    try {
      const txt = readFileSync(file, "utf8");
      const bodyLen = (txt.split("```")[1] || "").length;
      if (bodyLen >= MIN_CHARS) {
        console.log("skip", link.id, bodyLen);
        continue;
      }
    } catch {}
  }
  todo.push(link);
}
console.log("todo", todo.map((t) => t.id).join(","));

async function dumpPage(url) {
  await send("Page.navigate", { url });
  await sleep(3000);
  await ensurePost();
  await send("Runtime.evaluate", {
    expression: `(() => {
      for (const b of document.querySelectorAll('button[name="collapseSwitchButton"]')) { try{b.click()}catch(e){} }
      return 1;
    })()`,
    returnByValue: true,
  });
  await sleep(2500);
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const roots=[...document.querySelectorAll('.postcontent,.postbody')];
      const root=roots[0]||document.body;
      return { title: document.title, url: location.href, text: root.innerText };
    })()`,
    returnByValue: true,
  });
  return res.result?.value || {};
}

mkdirSync(mapsDir, { recursive: true });
const index = [];
for (const link of todo) {
  console.log("fetch", link.id, link.href);
  try {
    const page = await dumpPage(link.href);
    let body = (page.text || "").trim();
    const idx = body.indexOf(link.id);
    if (idx > 0 && idx < 200) body = body.slice(idx);
    if (body.length > 15000) body = body.slice(0, 15000) + "\n\n…（截断）";
    const md = `---
era: "2"
source: "${link.href}"
source_title: "${(page.title || "").replace(/"/g, "'")}"
updated: "2026-09-12"
summary: "常规图 ${link.id} ${link.name}（NGA tid=${tid} 楼层精简）"
map: "${link.id}"
fetch_status: "${body.length >= MIN_CHARS ? "ok" : "thin"}"
---

# ${link.id} ${link.name}

> 梦美常规图带路 · 二期 · 改造名须 Data MCP 核实

\`\`\`text
${body.replace(/```/g, "'''")}
\`\`\`
`;
    writeFileSync(join(mapsDir, `${link.id}.md`), md, "utf8");
    index.push({ id: link.id, chars: body.length });
    console.log("  ->", body.length);
  } catch (e) {
    console.error("fail", link.id, e.message);
    index.push({ id: link.id, error: e.message });
  }
}

// rebuild bundle from all files
const all = links
  .map((l) => {
    const file = join(mapsDir, `${l.id}.md`);
    if (!existsSync(file)) return { ...l, chars: 0 };
    const txt = readFileSync(file, "utf8");
    const bodyLen = (txt.split("```")[1] || "").length;
    return { ...l, chars: bodyLen };
  });
const bundle = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=${tid}"
updated: "2026-09-12"
summary: "常规图分图索引（NGA tid=${tid}）"
---

# 常规图分图索引

| 图 | 名称 | 正文字数 | 文件 |
|----|------|----------|------|
${all.map((f) => `| ${f.id} | ${f.name} | ${f.chars} | \`maps/${f.id}.md\` |`).join("\n")}
`;
writeFileSync(join(mapsDir, "..", "maps-all.md"), bundle, "utf8");
console.log("done", JSON.stringify(index));
ws.close();
