import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  return t;
}

function toBlock(raw, source) {
  const clean = cleanRouting(raw);
  if (!clean) return "";
  const lines = clean.split(/\r?\n/);
  const out = ["## 带路条件", "", `> 来源：${source}（NGA「带路条件」弹窗）`, ""];
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      out.push("");
      continue;
    }
    out.push(s.startsWith("-") || s.startsWith("|") || s.startsWith("#") ? s : `- ${s}`);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

const files = readdirSync(routingDir).filter((f) => f.endsWith(".json"));
let n = 0;
for (const jf of files) {
  const id = jf.replace(".json", "");
  const mapPath = join(mapsDir, `${id}.md`);
  const j = JSON.parse(readFileSync(join(routingDir, jf), "utf8"));
  if (!j.hasRouting || !j.routing) continue;
  const block = toBlock(j.routing, j.source || "");
  if (block.length < 60) continue;
  let md = readFileSync(mapPath, "utf8");
  // Force: if any 带路 heading exists, replace that whole section
  if (/^## 带路/m.test(md)) {
    md = md.replace(/^## 带路[\s\S]*?(?=\n## |$)/m, block + "\n");
  } else {
    md = md.trimEnd() + "\n\n" + block + "\n";
  }
  writeFileSync(mapPath, md, "utf8");
  n++;
  console.log(id, block.length);
}
console.log("wrote", n);
