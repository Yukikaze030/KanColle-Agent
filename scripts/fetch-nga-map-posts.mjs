/**
 * Extract map TOC links from NGA thread and dump each map post via CDP.
 * Usage: node scripts/fetch-nga-map-posts.mjs [tid]
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const tid = process.argv[2] || "23451223";
const port = Number(process.env.CDP_PORT || 9333);
const mapsDir = join(
  process.cwd(),
  ".opencode",
  "skills",
  "fleet-builder",
  "refs",
  "maps",
);

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const target =
  targets.find((t) => t.type === "page" && t.url.includes(String(tid))) ||
  targets.find((t) => t.type === "page");
if (!target) throw new Error("no page");
console.log("using", target.url);

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

// Guest jump if needed
let title = await send("Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true,
});
if (/访客不能直接访问/.test(title.result?.value || "")) {
  await send("Runtime.evaluate", {
    expression: `(() => {
      const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||''));
      if(a) a.click();
      return !!a;
    })()`,
    returnByValue: true,
  });
  await sleep(5000);
}

// Collect map links from current page (TOC)
const linksRes = await send("Runtime.evaluate", {
  expression: `(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a')) {
      const t = (a.innerText || '').trim();
      const href = a.href || '';
      const m = t.match(/^([1-7]-[1-6])\\s*(.*)$/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      // prefer pid links or same-thread anchors
      if (!/read\\.php|javascript/.test(href) && !href) continue;
      seen.add(id);
      out.push({ id, name: (m[2] || '').replace(/R$/,'').trim(), href, text: t });
    }
    return out;
  })()`,
  returnByValue: true,
});

let links = linksRes.result?.value || [];
console.log("toc links", links.length, links.map((l) => l.id).join(","));

// If too few, try floor links by scanning all read.php?pid=
if (links.length < 20) {
  const more = await send("Runtime.evaluate", {
    expression: `(() => {
      const out=[];
      for (const a of document.querySelectorAll('a')) {
        const t=(a.innerText||'').trim();
        const href=a.href||'';
        if (/read\\.php\\?pid=/.test(href) && /^\\[?[1-7]-[1-6]/.test(t)) {
          out.push({t, href});
        }
      }
      return out.slice(0, 80);
    })()`,
    returnByValue: true,
  });
  console.log("pid links sample", JSON.stringify(more.result?.value?.slice(0, 15), null, 2));
}

function slugify(id, name) {
  return `${id}`;
}

async function dumpPage(url) {
  await send("Page.navigate", { url });
  await sleep(4500);
  // guest jump
  const t0 = await send("Runtime.evaluate", {
    expression: "document.title",
    returnByValue: true,
  });
  if (/访客不能直接访问/.test(t0.result?.value || "")) {
    await send("Runtime.evaluate", {
      expression: `(() => {
        const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||''));
        if(a) a.click();
        return !!a;
      })()`,
      returnByValue: true,
    });
    await sleep(4000);
  }
  // expand collapses
  await send("Runtime.evaluate", {
    expression: `(() => {
      for (const b of document.querySelectorAll('button[name="collapseSwitchButton"]')) {
        try { b.click(); } catch(e) {}
      }
      for (const el of document.querySelectorAll('.collapse_content')) {
        if (!el.innerText.trim()) { try { el.parentElement?.querySelector('button')?.click(); } catch(e) {} }
      }
      return document.querySelectorAll('button[name="collapseSwitchButton"]').length;
    })()`,
    returnByValue: true,
  });
  await sleep(3500);
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const roots=[...document.querySelectorAll('.postcontent,.postbody')];
      const root=roots[0]||document.body;
      return {
        title: document.title,
        url: location.href,
        text: root.innerText,
        htmlLen: root.innerHTML.length,
      };
    })()`,
    returnByValue: true,
  });
  return res.result?.value || {};
}

mkdirSync(mapsDir, { recursive: true });
const index = [];

for (const link of links) {
  // normalize href
  let url = link.href;
  if (url.startsWith("javascript")) {
    // try pid from adjacent span style
    continue;
  }
  // if relative to pid, use it
  console.log("fetch", link.id, url.slice(0, 80));
  try {
    const page = await dumpPage(url);
    const text = (page.text || "").trim();
    // take content after map title if possible
    let body = text;
    const key = `${link.id}`;
    const idx = text.indexOf(key);
    if (idx >= 0) body = text.slice(idx);
    if (body.length > 15000) body = body.slice(0, 15000) + "\n\n…（截断）";
    const md = `---
era: "2"
source: "${url}"
source_title: "${(page.title || "").replace(/"/g, "'")}"
updated: "2026-09-12"
summary: "常规图 ${link.id} ${link.name}（NGA tid=${tid} 楼层精简）"
map: "${link.id}"
fetch_status: "${body.length > 80 ? "ok" : "thin"}"
---

# ${link.id} ${link.name}

> 梦美常规图带路 · 二期 · 改造名须 Data MCP 核实

\`\`\`text
${body.replace(/```/g, "'''")}
\`\`\`
`;
    const file = join(mapsDir, `${slugify(link.id, link.name)}.md`);
    writeFileSync(file, md, "utf8");
    index.push({
      id: link.id,
      name: link.name,
      url,
      chars: body.length,
      file,
    });
  } catch (e) {
    console.error("fail", link.id, e.message);
    index.push({ id: link.id, name: link.name, url, error: e.message });
  }
}

const bundle = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=${tid}"
updated: "2026-09-12"
summary: "常规图分图索引（NGA tid=${tid}）"
---

# 常规图分图索引

| 图 | 名称 | 字数 | 文件 |
|----|------|------|------|
${index
  .map(
    (f) =>
      `| ${f.id} | ${f.name} | ${f.chars ?? "ERR"} | \`maps/${f.id}.md\` |`,
  )
  .join("\n")}
`;
writeFileSync(join(mapsDir, "..", "maps-all.md"), bundle, "utf8");
writeFileSync(join(mapsDir, "_index.json"), JSON.stringify(index, null, 2), "utf8");
console.log(JSON.stringify(index, null, 2));
ws.close();
