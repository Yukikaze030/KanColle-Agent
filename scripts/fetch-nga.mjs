/**
 * Dump NGA page using the real Chrome user-data-dir (Chrome must be closed).
 * Usage: node scripts/fetch-nga.mjs [tid] [outPath]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const tid = process.argv[2] || "23451223";
const out =
  process.argv[3] ||
  join(process.cwd(), "docs", "guides", "_incoming", `nga-${tid}.html`);

const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userData =
  process.env.CHROME_USER_DATA ||
  join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data");
const url = `https://bbs.nga.cn/read.php?tid=${tid}`;

async function dumpDom(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const args = [
      `--user-data-dir=${userData}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-allow-origins=*",
      ...extraArgs,
      "--dump-dom",
      url,
    ];
    const child = spawn(chrome, args, { windowsHide: true });
    let outBuf = "";
    let errBuf = "";
    child.stdout.on("data", (d) => (outBuf += d.toString("utf8")));
    child.stderr.on("data", (d) => (errBuf += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (outBuf.trim()) resolve(outBuf);
      else reject(new Error(`empty dom code=${code} ${errBuf.slice(0, 400)}`));
    });
    setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, 60000);
  });
}

async function main() {
  let html = "";
  try {
    html = await dumpDom();
  } catch (e) {
    console.error("try1", e.message);
    html = await dumpDom(["--headless=old"]);
  }
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, html, "utf8");
  const blocked =
    html.includes("访客不能直接访问") ||
    /ERROR:<!--msgcodestart-->/.test(html);
  const hasTopic =
    html.includes("topic") || html.includes("postcontent") || html.includes("postitem");
  console.log(
    JSON.stringify(
      { out, bytes: html.length, blocked, hasTopic, titleHint: html.slice(0, 200) },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
