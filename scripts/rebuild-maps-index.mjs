import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(
  process.cwd(),
  ".opencode/sskills/fleet-builder/refs/maps".replace("sskills", "skills"),
);
const files = readdirSync(dir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .sort((a, b) => {
    const [aa, ab] = a.replace(".md", "").split("-").map(Number);
    const [ba, bb] = b.replace(".md", "").split("-").map(Number);
    return aa - ba || ab - bb;
  });

const rows = [];
let thin = 0;
let noSlim = 0;
for (const f of files) {
  const t = readFileSync(join(dir, f), "utf8");
  const body = t.replace(/^---[\s\S]*?---/, "").trim();
  const slim = /slimmed:\s*true/.test(t);
  const status = (t.match(/fetch_status:\s*"?([^\n"]+)"?/) || [])[1] || "";
  const title = (body.match(/^#\s*(.+)$/m) || [])[1] || f;
  if (!slim) noSlim++;
  if (body.length < 500) {
    thin++;
    console.log("THIN", f, body.length, title);
  }
  rows.push({ f, title, len: body.length, slim, status: status.trim() });
}

console.log("count", files.length, "thin", thin, "no_slim_flag", noSlim);
console.log(rows.map((r) => `${r.f}\t${r.len}\t${r.slim ? "slim" : "?"}\t${r.status}`).join("\n"));

const bundle = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=23451223"
updated: "2026-09-12"
summary: "常规图分图索引（NGA tid=23451223，已精简）"
slimmed: true
---

# 常规图分图索引

已精简：仅保留带路、推荐编成、Boss/制空要点与任务配置。改造名须 Data MCP 核实。

| 图 | 正文字数 | 状态 | 文件 |
|----|----------|------|------|
${rows
  .map(
    (r) =>
      `| ${r.f.replace(".md", "")} | ${r.len} | ${r.status || "ok"} | \`maps/${r.f}\` |`,
  )
  .join("\n")}

## 备注

- \`6-5\`：源帖该楼抓取内容偏薄，仅作占位；需要时用调试 Chrome 重抓 pid。
- 完整原始文本：\`maps/_raw-post.txt\`（未精简）。
`;

writeFileSync(join(dir, "..", "maps-all.md"), bundle, "utf8");
console.log("wrote maps-all.md");
