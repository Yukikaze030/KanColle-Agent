/**
 * Expand all NGA collapse boxes and dump per-map sections as markdown.
 * Usage: node scripts/fetch-nga-maps.mjs [tid]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const tid = process.argv[2] || "23451223";
const port = Number(process.env.CDP_PORT || 9333);
const outDir = join(
  process.cwd(),
  ".opencode",
  "skills",
  "fleet-builder",
  "refs",
  "maps",
);
const bundleOut = join(
  process.cwd(),
  ".opencode",
  "skills",
  "fleet-builder",
  "refs",
  "maps-all.md",
);

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const pages = targets.filter((t) => t.type === "page");
const target =
  pages.find((t) => t.url.includes(String(tid))) ||
  pages.find((t) => /带路|NGA/.test(t.title)) ||
  pages[0];
if (!target) throw new Error("no page");
console.log("using", target.title, target.url);

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

await send("Runtime.enable");
await send("Page.enable");

// Ensure we're on the real post, not guest error
let title = await send("Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true,
});
if (/访客不能直接访问/.test(title.result?.value || "")) {
  const click = await send("Runtime.evaluate", {
    expression: `(() => {
      const a = [...document.querySelectorAll('a')].find(x => /点此链接/.test(x.innerText||''));
      if (a) { a.click(); return true; } return false;
    })()`,
    returnByValue: true,
  });
  console.log("guest jump", click.result?.value);
  await sleep(5000);
}

// Expand collapses / click "显示" toggles
const expand = await send("Runtime.evaluate", {
  expression: `(() => {
    const clicked = [];
    // NGA collapse headers
    for (const el of document.querySelectorAll(
      '.collapsebox .collapsehead, .collapse_head, .spoiler-head, [class*="collapse"] a, [class*="spoiler"] a, .clickable'
    )) {
      try { el.click(); clicked.push((el.innerText||'').slice(0,40)); } catch(e) {}
    }
    // text nodes that look like expand buttons
    for (const el of document.querySelectorAll('span,div,a')) {
      const t = (el.innerText||'').trim();
      if (/^点击显示|^\\+ 点击显示|显示隐藏/.test(t) && el.children.length === 0) {
        try { el.click(); clicked.push(t.slice(0,40)); } catch(e) {}
      }
    }
    return { count: clicked.length, sample: clicked.slice(0, 20) };
  })()`,
  returnByValue: true,
});
console.log("expand", JSON.stringify(expand.result?.value));
await sleep(2000);

// Second pass expand
await send("Runtime.evaluate", {
  expression: `(() => {
    for (const el of document.querySelectorAll('.collapsebox, .spoiler')) {
      el.classList.add('open','expanded','show');
      const c = el.querySelector('[style*="display: none"], [style*="display:none"]');
      if (c) c.style.display = 'block';
    }
    for (const el of document.querySelectorAll('[style*="display: none"]')) {
      if ((el.innerText||'').length > 50) el.style.display = 'block';
    }
    return true;
  })()`,
  returnByValue: true,
});
await sleep(1000);

const dump = await send("Runtime.evaluate", {
  expression: `(() => {
    const posts = [...document.querySelectorAll('.postcontent, .postbody, [id^="postcontent"], .forum-content, #m_posts_c, .topic-content')];
    const root = posts[0] || document.body;
    const html = root.innerHTML;
    const text = root.innerText;
    return {
      title: document.title,
      url: location.href,
      rootClass: root.className || root.id,
      html,
      text,
      collapseCount: document.querySelectorAll('[class*="collapse"],[class*="spoiler"]').length,
    };
  })()`,
  returnByValue: true,
});

const data = dump.result?.value || {};
console.log(
  "dump",
  JSON.stringify({
    title: data.title,
    textLen: (data.text || "").length,
    htmlLen: (data.html || "").length,
    collapseCount: data.collapseCount,
  }),
);

mkdirSync(outDir, { recursive: true });
const rawPath = join(outDir, "_raw-post.txt");
writeFileSync(rawPath, data.text || "", "utf8");
writeFileSync(join(outDir, "_raw-post.html"), data.html || "", "utf8");

// Split by map headings
const text = data.text || "";
const mapRe =
  /([1-7]-[1-6])\s*([^\n]{0,40}?)R?\s*\n/g;
const marks = [];
let m;
while ((m = mapRe.exec(text))) {
  const id = m[1];
  if (marks.some((x) => x.id === id)) continue;
  marks.push({ id, name: (m[2] || "").trim(), start: m.index });
}
console.log(
  "found maps",
  marks.map((x) => x.id + " " + x.name),
);

const files = [];
for (let i = 0; i < marks.length; i++) {
  const start = marks[i].start;
  const end = i + 1 < marks.length ? marks[i + 1].start : start + 8000;
  let body = text.slice(start, Math.min(end, start + 12000)).trim();
  // trim huge trailing noise
  if (body.length > 6000) body = body.slice(0, 6000) + "\n\n…（截断，完整见 raw）";
  const id = marks[i].id;
  const name = marks[i].name || id;
  const md = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=${tid}"
source_title: "梦美常规图带路"
updated: "2026-09-12"
summary: "常规图 ${id} ${name} 带路/配置（NGA tid=${tid} 精简）"
map: "${id}"
---

# ${id} ${name}

> 来自 NGA「梦美的常规图带路 & 出击配置」；改造形态须 Data MCP 核实。

\`\`\`text
${body.replace(/```/g, "'''")}
\`\`\`
`;
  const file = join(outDir, `${id.replace("-", "-")}.md`);
  writeFileSync(file, md, "utf8");
  files.push({ id, name, file, chars: body.length });
}

// bundle index
const bundle = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=${tid}"
updated: "2026-09-12"
summary: "全部常规图带路索引（NGA tid=${tid}）"
---

# 常规图带路索引

| 图 | 名称 | 文件 |
|----|------|------|
${files.map((f) => `| ${f.id} | ${f.name} | \`maps/${f.id}.md\` (${f.chars}字) |`).join("\n")}

原始全文：\`maps/_raw-post.txt\`
`;
writeFileSync(bundleOut, bundle, "utf8");

console.log(JSON.stringify({ files, rawPath, bundleOut }, null, 2));
ws.close();
