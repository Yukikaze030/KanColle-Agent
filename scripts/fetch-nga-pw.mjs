/**
 * Fetch NGA with Playwright persistent context on the real Chrome profile.
 * Chrome must be fully closed.
 * Usage: node scripts/fetch-nga-pw.mjs [tid]
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tid = process.argv[2] || "23451223";
const userData = join(
  process.env.LOCALAPPDATA || "",
  "Google",
  "Chrome",
  "User Data",
);
const outDir = join(process.cwd(), "docs", "guides", "_incoming");
const out = join(outDir, `nga-${tid}.html`);
const url = `https://bbs.nga.cn/read.php?tid=${tid}`;

const context = await chromium.launchPersistentContext(userData, {
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 2000 },
  locale: "zh-CN",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  args: ["--no-first-run", "--no-default-browser-check"],
});

try {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const html = await page.content();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(out, html, "utf8");
  const blocked =
    html.includes("访客不能直接访问") || html.includes("msgcodestart");
  const text = await page.evaluate(() => document.body?.innerText || "");
  console.log(
    JSON.stringify(
      {
        out,
        bytes: html.length,
        blocked,
        title: await page.title(),
        textPreview: text.replace(/\s+/g, " ").slice(0, 400),
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
}
