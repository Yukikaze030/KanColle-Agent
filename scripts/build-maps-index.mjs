/**
 * Build data/kancolle-maps/index.json from meta/*.json + skill maps.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "data", "kancolle-maps");
const metaDir = join(root, "meta");
const mapsMd = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");

const ids = readdirSync(metaDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .sort((a, b) => {
    const [aa, ab] = a.split("-").map(Number);
    const [ba, bb] = b.split("-").map(Number);
    return aa - ba || ab - bb;
  });

const items = ids.map((id) => {
  const meta = JSON.parse(readFileSync(join(metaDir, `${id}.json`), "utf8"));
  const mdPath = join(mapsMd, `${id}.md`);
  const htmlPath = join(root, "html", `${id}.html`);
  const name = (meta.source_title || "").replace(/^.*?\]\s*/, "").replace(/\s*NGA.*$/, "").trim();
  return {
    map_id: id,
    area: Number(id.split("-")[0]),
    map_no: Number(id.split("-")[1]),
    name_jp: name || id,
    source_url: meta.source_url,
    source_title: meta.source_title,
    era: "2",
    tid: meta.tid || "23451223",
    has_routing: Boolean(meta.has_routing),
    has_enemy: Boolean(meta.has_enemy),
    routing_chars: meta.routing_chars || 0,
    enemy_chars: meta.enemy_chars || 0,
    files: {
      meta: `data/kancolle-maps/meta/${id}.json`,
      html: existsSync(htmlPath) ? `data/kancolle-maps/html/${id}.html` : null,
      raw: existsSync(join(root, "raw", `${id}.txt`)) ? `data/kancolle-maps/raw/${id}.txt` : null,
      skill_md: existsSync(mdPath) ? `.opencode/skills/fleet-builder/refs/maps/${id}.md` : null,
    },
  };
});

const index = {
  schema: "kancolle-maps/1",
  era: "2",
  source: "https://bbs.nga.cn/read.php?tid=23451223",
  generated_at: new Date().toISOString(),
  count: items.length,
  heading_schema: [
    "# <id> <name>",
    "## 地图信息",
    "## 带路条件",
    "## 敌方配置",
    "## 制空 / 索敌",
    "## 推荐编成",
    "## 任务配置",
  ],
  items,
};

writeFileSync(join(root, "index.json"), JSON.stringify(index, null, 2), "utf8");
console.log("index", items.length, "maps", "html", items.filter((i) => i.files.html).length);
