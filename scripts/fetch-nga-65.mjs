import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 9333;
const tid = "23451223";

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const targets = await getJson("/json/list");
const target = targets.find((t) => t.type === "page") || targets[0];
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

await send("Page.navigate", { url: `https://bbs.nga.cn/read.php?tid=${tid}` });
await sleep(3000);
let t = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
if (/访客不能直接访问/.test(t.result?.value || "")) {
  await send("Runtime.evaluate", {
    expression: `(()=>{const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||''));if(a)a.click();return !!a})()`,
    returnByValue: true,
  });
  await sleep(4000);
}

const link = await send("Runtime.evaluate", {
  expression: `(()=>{for(const a of document.querySelectorAll('a')){const t=(a.innerText||'').trim();const h=a.href||'';if(/^6-5\\b/.test(t)&&/pid=/.test(h))return {t,h};}return null})()`,
  returnByValue: true,
});
console.log("6-5 link", link.result?.value);
if (!link.result?.value) {
  console.error("no 6-5 pid");
  process.exit(1);
}

await send("Page.navigate", { url: link.result.value.h });
await sleep(3500);
t = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
if (/访客不能直接访问/.test(t.result?.value || "")) {
  await send("Runtime.evaluate", {
    expression: `(()=>{const a=[...document.querySelectorAll('a')].find(x=>/点此链接/.test(x.innerText||''));if(a)a.click();return !!a})()`,
    returnByValue: true,
  });
  await sleep(4000);
}
await send("Runtime.evaluate", {
  expression: `(()=>{for(const b of document.querySelectorAll('button[name="collapseSwitchButton"]')){try{b.click()}catch(e){}}return 1})()`,
  returnByValue: true,
});
await sleep(3000);

const dump = await send("Runtime.evaluate", {
  expression: `(()=>{const roots=[...document.querySelectorAll('.postcontent,.postbody')];const root=roots[0]||document.body;return {title:document.title,url:location.href,text:root.innerText}})()`,
  returnByValue: true,
});
const page = dump.result?.value || {};
let body = (page.text || "").trim();
const idx = body.indexOf("6-5");
if (idx >= 0 && idx < 300) body = body.slice(idx);
console.log("title", page.title);
console.log("chars", body.length);
console.log(body.slice(0, 800));
writeFileSync(join(process.cwd(), "docs/guides/_incoming/nga-6-5-raw.txt"), body, "utf8");
ws.close();
