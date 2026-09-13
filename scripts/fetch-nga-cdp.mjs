/**
 * Fetch NGA via Chrome CDP.
 * Note: Chrome ignores --remote-debugging-port on the default user-data-dir.
 * We copy profile to a temp dir so debugging works. Chrome must be closed.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const tid = process.argv[2] || "23451223";
const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const realUserData = join(
  process.env.LOCALAPPDATA || "",
  "Google",
  "Chrome",
  "User Data",
);
const userData = join(tmpdir(), "nga-cdp-profile");
const port = 9333;
const url = `https://bbs.nga.cn/read.php?tid=${tid}`;
const out = join(process.cwd(), "docs", "guides", "_incoming", `nga-${tid}.html`);

function copyProfile() {
  rmSync(userData, { recursive: true, force: true });
  mkdirSync(join(userData, "Default", "Network"), { recursive: true });
  const localState = join(realUserData, "Local State");
  if (!existsSync(localState)) throw new Error("Chrome Local State missing");
  cpSync(localState, join(userData, "Local State"));
  const files = [
    ["Default\\Preferences", "Default\\Preferences"],
    ["Default\\Network\\Cookies", "Default\\Network\\Cookies"],
    ["Default\\Login Data", "Default\\Login Data"],
    ["Default\\Web Data", "Default\\Web Data"],
  ];
  for (const [from, to] of files) {
    const s = join(realUserData, from);
    const d = join(userData, to);
    if (existsSync(s)) {
      mkdirSync(join(d, ".."), { recursive: true });
      try {
        cpSync(s, d);
      } catch (e) {
        console.error("skip", from, e.message);
      }
    }
  }
  console.log("profile copied to", userData);
}

copyProfile();

const child = spawn(
  chrome,
  [
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    url,
  ],
  { windowsHide: false, stdio: ["ignore", "pipe", "pipe"] },
);
child.stderr.on("data", (d) => process.stderr.write(d));
child.stdout.on("data", (d) => process.stderr.write(d));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function waitForDebugger() {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await getJson("/json/version");
      return v;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("CDP not ready");
}

try {
  const version = await waitForDebugger();
  console.log("cdp", version.Browser || version.WebSocketDebuggerUrl);
  await sleep(2000);
  // list targets
  const targets = await getJson("/json/list");
  const page = targets.find((t) => t.type === "page" && t.url.includes("nga"));
  const target = page || targets.find((t) => t.type === "page");
  if (!target) throw new Error("no page target: " + JSON.stringify(targets).slice(0, 300));
  console.log("target", target.url, target.title);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const idToResolve = new Map();
  let nextId = 1;
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && idToResolve.has(msg.id)) {
      const { resolve, reject } = idToResolve.get(msg.id);
      idToResolve.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      idToResolve.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "https://bbs.nga.cn/" });
  await sleep(3000);
  await send("Page.navigate", { url });
  await sleep(8000);
  const cookies = await send("Network.getAllCookies");
  const nga = (cookies.cookies || []).filter(
    (c) => c.domain.includes("nga") || c.domain.includes("178"),
  );
  console.log(
    "nga cookies",
    nga.map((c) => `${c.name}@${c.domain}=${String(c.value).slice(0, 12)}...`).join("\n"),
  );
  const evalRes = await send("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
  });
  const html = evalRes.result?.value || "";
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, html, "utf8");
  const blocked = html.includes("访客不能直接访问") || html.includes("msgcodestart");
  const bodyText = await send("Runtime.evaluate", {
    expression: "document.body ? document.body.innerText : ''",
    returnByValue: true,
  });
  console.log(
    JSON.stringify(
      {
        out,
        bytes: html.length,
        blocked,
        title: target.title,
        textPreview: String(bodyText.result?.value || "")
          .replace(/\s+/g, " ")
          .slice(0, 500),
      },
      null,
      2,
    ),
  );
  ws.close();
} finally {
  child.kill();
}
