/**
 * Attach to already-running Chrome with --remote-debugging-port=9333
 * and dump an NGA thread. Do NOT launch Chrome.
 * Usage: node scripts/fetch-nga-attach.mjs [tid]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const tid = process.argv[2] || "23451223";
const port = Number(process.env.CDP_PORT || 9333);
const url = `https://bbs.nga.cn/read.php?tid=${tid}`;
const out = join(process.cwd(), "docs", "guides", "_incoming", `nga-${tid}.html`);

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const version = await getJson("/json/version");
console.log("browser", version.Browser);

const targets = await getJson("/json/list");
console.log(
  "pages",
  targets.filter((t) => t.type === "page").map((t) => ({ title: t.title, url: t.url })),
);

// Prefer an existing nga tab; else first page
let target =
  targets.find((t) => t.type === "page" && /nga\.cn|178\.com/.test(t.url)) ||
  targets.find((t) => t.type === "page");
if (!target) throw new Error("no page target — open a tab in debug Chrome first");

console.log("using", target.url, target.title);

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
await send("Network.enable");
await send("Page.navigate", { url });
await sleep(6000);

const cookies = await send("Network.getAllCookies");
const nga = (cookies.cookies || []).filter(
  (c) => c.domain.includes("nga") || c.domain.includes("178"),
);
console.log(
  "nga cookies",
  nga.map((c) => `${c.name}@${c.domain}=${String(c.value).slice(0, 16)}`).join("\n"),
);

const title = await send("Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true,
});
const htmlRes = await send("Runtime.evaluate", {
  expression: "document.documentElement.outerHTML",
  returnByValue: true,
});
const textRes = await send("Runtime.evaluate", {
  expression: "document.body ? document.body.innerText : ''",
  returnByValue: true,
});

const html = htmlRes.result?.value || "";
const text = String(textRes.result?.value || "");
mkdirSync(join(out, ".."), { recursive: true });
writeFileSync(out, html, "utf8");
const blocked = html.includes("访客不能直接访问") || html.includes("msgcodestart");
const hasPost = /postcontent|postitem|topic|楼主|发帖/.test(html);

console.log(
  JSON.stringify(
    {
      out,
      title: title.result?.value,
      bytes: html.length,
      blocked,
      hasPost,
      textPreview: text.replace(/\s+/g, " ").slice(0, 600),
    },
    null,
    2,
  ),
);

ws.close();
