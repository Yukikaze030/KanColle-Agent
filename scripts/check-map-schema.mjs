import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const need = ["地图信息", "带路条件", "敌方配置", "制空 / 索敌", "推荐编成", "任务配置"];
const files = readdirSync(dir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .sort();
let ok = 0;
const bad = [];
for (const f of files) {
  const t = readFileSync(join(dir, f), "utf8");
  const heads = t
    .split(/\n/)
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());
  const miss = need.filter((h) => !heads.includes(h));
  const legacy = heads.filter((h) =>
    ["带路", "相关任务", "出击任务", "地图分析"].includes(h),
  );
  if (!miss.length && !legacy.length) ok++;
  else bad.push({ f, miss, legacy });
}
console.log(`schema_ok ${ok} of ${files.length}`);
if (bad.length) console.log(JSON.stringify(bad, null, 2));
