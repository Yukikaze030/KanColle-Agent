/**
 * Merge _routing/<id>.json into maps/<id>.md under ## 带路条件.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mapsDir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const routingDir = join(mapsDir, "_routing");

function cleanRouting(text) {
  if (!text) return "";
  let t = text
    .replace(/^带路条件\(新窗口\)R\s*/m, "")
    .replace(/^− 地图分析 \.\.\.\s*/m, "")
    .replace(/\(新窗口\)R/g, "")
    .replace(/^R\s*$/gm, "")
    .replace(/^\+ 点击显示.*$/gm, "")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // drop leftover collapse chrome
  t = t.replace(/^-\s*地图分析\s*$/m, "").trim();
  return t;
}

function toMarkdownBlock(raw, source) {
  const clean = cleanRouting(raw);
  if (!clean) return "";
  const lines = clean.split(/\r?\n/);
  const out = ["## 带路条件", "", `> 来源：${source}（NGA 带路条件弹窗）`, ""];
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      out.push("");
      continue;
    }
    // table-ish rows with tabs already flattened
    if (/^(路线|需求|制空|索敌|流派|带路|分歧)/.test(s) || s.includes("路线")) {
      out.push(`- ${s}`);
    } else if (/^[A-Z](-[A-Z])+$/.test(s) || /路线：/.test(s)) {
      out.push(`- **${s}**`);
    } else {
      out.push(s.startsWith("-") || s.startsWith("|") || s.startsWith("#") ? s : `- ${s}`);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

const files = readdirSync(routingDir).filter((f) => f.endsWith(".json"));
let merged = 0;
let skipped = 0;

for (const jf of files) {
  const id = jf.replace(".json", "");
  const mapPath = join(mapsDir, `${id}.md`);
  if (!existsSync(mapPath)) {
    console.log("no map md", id);
    continue;
  }
  const j = JSON.parse(readFileSync(join(routingDir, jf), "utf8"));
  if (!j.hasRouting || !j.routing) {
    console.log("no routing", id, j.routingChars);
    skipped++;
    continue;
  }
  const block = toMarkdownBlock(j.routing, j.source || "");
  if (!block || block.length < 80) {
    console.log("thin block", id, block.length);
    skipped++;
    continue;
  }

  let md = readFileSync(mapPath, "utf8");
  if (/^## 带路条件/m.test(md)) {
    md = md.replace(/^## 带路条件[\s\S]*?(?=\n## )/, block + "\n\n");
  } else if (/^## 带路/m.test(md)) {
    // replace existing 带路 section (no \b after CJK)
    md = md.replace(/^## 带路[\s\S]*?(?=\n## )/, block + "\n\n");
  } else {
    // insert before ## 制空 or ## 推荐编成 or ## 任务
    const m = md.match(/\n## (制空|推荐编成|任务|出击任务|相关任务)/);
    if (m) {
      md = md.replace(m[0], `\n${block}\n${m[0]}`);
    } else {
      md = md.trimEnd() + `\n\n${block}\n`;
    }
  }
  writeFileSync(mapPath, md, "utf8");
  merged++;
  console.log("merged", id, block.length);
}

console.log(JSON.stringify({ merged, skipped, files: files.length }));
