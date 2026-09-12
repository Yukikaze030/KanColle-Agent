/**
 * Dump currently open NGA tab content via CDP without reloading.
 * Usage: node scripts/fetch-nga-current.mjs [tid]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tid = process.argv[2] || "23451223";
const port = Number(process.env.CDP_PORT || 9333);
const out = join(process.cwd(), "docs", "guides", "_incoming", `nga-${tid}.html`);

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const pages = targets.filter((t) => t.type === "page");
console.log(
  "pages",
  pages.map((t) => ({ title: t.title, url: t.url })),
);

const target =
  pages.find((t) => t.url.includes(String(tid))) ||
  pages.find((t) => t.title.includes("带路") || t.title.includes("NGA"));
if (!target) throw new Error("NGA tab not found");

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
writeFileSync(out.replace(/\.html$/, ".txt"), text, "utf8");

const blocked = html.includes("访客不能直接访问") || /ERROR:<!--msgcodestart-->/.test(html);
const hasPost = /postcontent|postitem|楼主|发帖|content/.test(html) && text.length > 800;

console.log(
  JSON.stringify(
    {
      out,
      title: title.result?.value,
      bytes: html.length,
      textLen: text.length,
      blocked,
      hasPost,
      textPreview: text.replace(/\s+/g, " ").slice(0, 800),
    },
    null,
    2,
  ),
);

ws.close();
