/**
 * Aggregate quest sortie configs from fleet-builder maps into one lookup file.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mapsDir = join(
  process.cwd(),
  ".opencode/skills/fleet-builder/refs/maps",
);
const out = join(
  process.cwd(),
  ".opencode/skills/fleet-builder/refs/quest-sortie-configs.md",
);

const files = readdirSync(mapsDir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .sort((a, b) => {
    const [aa, ab] = a.replace(".md", "").split("-").map(Number);
    const [ba, bb] = b.replace(".md", "").split("-").map(Number);
    return aa - ba || ab - bb;
  });

/** Extract markdown table rows under task-ish headings or any Bxx/Cxx/By/Bq/Bm/Bw/Bd cells */
function extractQuestRows(mapId, text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let inTaskSection = false;
  let headers = [];

  for (const line of lines) {
    if (/^#{2,3}\s+.*(任务|出击任务|相关任务)/.test(line)) {
      inTaskSection = true;
      headers = [];
      continue;
    }
    if (/^#{2,3}\s+/.test(line) && !/任务/.test(line)) {
      inTaskSection = false;
      headers = [];
      continue;
    }
    if (!line.includes("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
    if (cells.every((c) => /^-{2,}$/.test(c) || c === "")) continue;
    if (cells.length >= 3 && /^任务|^ID|任务名/.test(cells[0])) {
      headers = cells;
      continue;
    }
    const joined = cells.join(" ");
    const hasQuestId = /\[(B[dmqw]|By\d|C\d+|A\d+|F\d+|D\d+|G\d+|W\d+)\]|\bB\d{1,3}\b|\bBy\d+\b|\bBq\d+\b|\bBm\d+\b|\bBw\d+\b|\bBd\d+\b/.test(joined);
    if (!hasQuestId) continue;
    // Prefer task-section rows, but also accept any table row with quest-like id
    if (!inTaskSection && !/\[B/.test(joined) && !/\[By/.test(joined)) continue;
    rows.push({ map: mapId, cells, raw: line });
  }
  return rows;
}

const byQuest = new Map();

for (const f of files) {
  const mapId = f.replace(".md", "");
  const text = readFileSync(join(mapsDir, f), "utf8");
  const rows = extractQuestRows(mapId, text);
  for (const r of rows) {
    // first cell often contains [Bxx] or task name
    const keyCell = r.cells[0] || "";
    const m =
      keyCell.match(/\[([^\]]+)\]/) ||
      keyCell.match(/\b((?:B|By|Bq|Bm|Bw|Bd|C|A|D|F|G)\d{1,3})\b/);
    const qid = m ? m[1] : keyCell.slice(0, 40);
    if (!qid || qid.length < 2) continue;
    if (!byQuest.has(qid)) {
      byQuest.set(qid, {
        qid,
        name: keyCell.replace(/\[[^\]]+\]/g, "").trim() || qid,
        entries: [],
      });
    }
    const rec = byQuest.get(qid);
    if (keyCell.length > rec.name.length) {
      rec.name = keyCell.replace(/\[[^\]]+\]/g, "").trim() || rec.name;
    }
    rec.entries.push({ map: mapId, cells: r.cells });
  }
}

// Also pull simple bullets that look like quest configs without tables
// (already covered if tables exist)

const sorted = [...byQuest.values()].sort((a, b) => a.qid.localeCompare(b.qid, "en", { numeric: true }));

const md = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=23451223"
updated: "2026-09-12"
summary: "出击任务 → 推荐海域/编成中央索引（从 maps/*.md 任务表汇总）"
slimmed: true
---

# 出击任务配置推荐（中央索引）

> **使用流程（quest-planner / fleet-builder）**  
> 1. Data MCP \`kc_search\` → 得到任务 ID / 名称 / wiki_id  
> 2. 在本表按 ID 或名称查找推荐海域与编成  
> 3. 命中则直接给配置；未命中再读 \`maps/<图>.md\` 或 researcher  
> 4. 编成中的改造形态必须 \`kc_ship_remodel\` 核实  

索引数：**${sorted.length}** 条任务键 · 来源：梦美常规图带路（NGA tid=23451223）

## 快速索引

| 任务键 | 名称 | 出现图 |
|--------|------|--------|
${sorted
  .map((q) => {
    const maps = [...new Set(q.entries.map((e) => e.map))].join(", ");
    const name = q.name.replace(/\|/g, "/").slice(0, 40);
    return `| \`${q.qid}\` | ${name} | ${maps} |`;
  })
  .join("\n")}

## 分任务明细

${sorted
  .map((q) => {
    const maps = [...new Set(q.entries.map((e) => e.map))];
    const lines = [];
    lines.push(`### ${q.qid} ${q.name}`);
    lines.push("");
    lines.push(`出现图：${maps.map((m) => `[\`${m}\`](maps/${m}.md)`).join(" · ")}`);
    lines.push("");
    for (const e of q.entries) {
      lines.push(`**${e.map}**`);
      lines.push("");
      lines.push(`| ${e.cells.join(" | ")} |`);
      // markdown table needs header separator if we want valid table — use bullet instead if odd
      lines.push("");
    }
    return lines.join("\n");
  })
  .join("\n")}
`;

// Fix: single-row pipe lines need a header for valid md tables.
// Simpler: emit as blockquote/code-ish bullets
const md2 = `---
era: "2"
source: "https://bbs.nga.cn/read.php?tid=23451223"
updated: "2026-09-12"
summary: "出击任务 → 推荐海域/编成中央索引（从 maps/*.md 任务表汇总）"
slimmed: true
---

# 出击任务配置推荐（中央索引）

> **使用流程**  
> 1. Data MCP \`kc_search\` / \`kc_get\` → 任务 game_id、名称、wiki_id  
> 2. 在本表查找推荐海域与编成（优先 wiki_id / 日文名）  
> 3. 命中 → 给出海域+编成；未命中 → 读对应 \`maps/<图>.md\` 或 kcwiki-researcher  
> 4. 提到改造形态 → 必须 \`kc_ship_remodel\` 核实  

来源：NGA 梦美常规图带路 tid=23451223 · 二期 · 共 **${sorted.length}** 键

## 一览

| 键 | 名称 | 图 |
|----|------|-----|
${sorted
  .map((q) => {
    const maps = [...new Set(q.entries.map((e) => e.map))].join(", ");
    return `| \`${q.qid}\` | ${q.name.replace(/\|/g, "/").slice(0, 48)} | ${maps} |`;
  })
  .join("\n")}

## 明细

${sorted
  .map((q) => {
    const maps = [...new Set(q.entries.map((e) => e.map))];
    const parts = [`### ${q.qid}`, "", q.name, "", `图：${maps.map((m) => `\`${m}\``).join(" ")}`, ""];
    for (const e of q.entries) {
      parts.push(`- **${e.map}**：${e.cells.filter(Boolean).join(" · ")}`);
    }
    parts.push("");
    return parts.join("\n");
  })
  .join("\n")}
`;

writeFileSync(out, md2, "utf8");
console.log(
  JSON.stringify(
    {
      maps: files.length,
      quests: sorted.length,
      out,
      sample: sorted.slice(0, 15).map((q) => q.qid),
    },
    null,
    2,
  ),
);
