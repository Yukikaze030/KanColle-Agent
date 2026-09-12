/**
 * Click NGA guest-page redirect link and dump content via CDP.
 * Usage: node scripts/fetch-nga-click.mjs [tid]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

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
console.log("pages", pages.map((t) => ({ title: t.title, url: t.url })));
const target =
  pages.find((t) => t.url.includes(String(tid))) ||
  pages.find((t) => t.type === "page");
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

await send("Runtime.enable");
await send("Page.enable");

const probe = await send("Runtime.evaluate", {
  expression: `(() => {
    const links = [...document.querySelectorAll('a')].map(a => ({text: (a.innerText||'').trim(), href: a.href}));
    return {
      title: document.title,
      url: location.href,
      body: (document.body?.innerText||'').slice(0,300),
      links,
      htmlLen: document.documentElement.outerHTML.length
    };
  })()`,
  returnByValue: true,
});
console.log("probe", JSON.stringify(probe.result?.value, null, 2).slice(0, 1500));

// Click link that looks like the manual jump
const clicked = await send("Runtime.evaluate", {
  expression: `(() => {
    const as = [...document.querySelectorAll('a')];
    const hit = as.find(a => /点此链接|自动跳转|read\\.php/.test((a.innerText||'') + a.href));
    if (!hit) return {ok:false, reason:'no link', links: as.map(a=>({t:a.innerText,h:a.href}))};
    const href = hit.href;
    hit.click();
    return {ok:true, href, text: hit.innerText};
  })()`,
  returnByValue: true,
});
console.log("click", JSON.stringify(clicked.result?.value));

// Also navigate in case click is JS-only
const href = clicked.result?.value?.href;
if (href) {
  await send("Page.navigate", { url: href });
} else {
  await send("Page.navigate", {
    url: `https://bbs.nga.cn/read.php?tid=${tid}&_ff=-100`,
  });
}
await sleep(5000);

// If still blocked, try the classic guest bypass URL patterns
let htmlRes = await send("Runtime.evaluate", {
  expression: "document.documentElement.outerHTML",
  returnByValue: true,
});
let html = htmlRes.result?.value || "";
console.log("after click title check bytes", html.length, /访客不能直接访问|msgcodestart/.test(html));

if (/访客不能直接访问|msgcodestart/.test(html)) {
  const alts = [
    `https://bbs.nga.cn/read.php?tid=${tid}&page=1&topage=1&rand=123`,
    `https://nga.178.com/read.php?tid=${tid}`,
  ];
  for (const u of alts) {
    console.log("try", u);
    await send("Page.navigate", { url: u });
    await sleep(4000);
    htmlRes = await send("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    });
    html = htmlRes.result?.value || "";
    console.log(" -> bytes", html.length, "blocked", /访客不能直接访问|msgcodestart/.test(html));
    if (!/访客不能直接访问|msgcodestart/.test(html) && html.length > 10000) break;
  }
}

const title = await send("Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true,
});
const textRes = await send("Runtime.evaluate", {
  expression: "document.body ? document.body.innerText : ''",
  returnByValue: true,
});
const text = String(textRes.result?.value || "");
mkdirSync(join(out, ".."), { recursive: true });
writeFileSync(out, html, "utf8");
writeFileSync(out.replace(/\.html$/, ".txt"), text, "utf8");
const blocked = /访客不能直接访问|msgcodestart/.test(html);
console.log(
  JSON.stringify(
    {
      out,
      title: title.result?.value,
      bytes: html.length,
      textLen: text.length,
      blocked,
      preview: text.replace(/\s+/g, " ").slice(0, 700),
    },
    null,
    2,
  ),
);
ws.close();
