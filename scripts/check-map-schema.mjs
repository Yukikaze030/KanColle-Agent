import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const need = ["overview", "routing", "enemy", "air-los", "fleets", "quests", "notes"];
const files = readdirSync(dir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .sort();
let ok = 0;
const bad = [];
for (const f of files) {
  const t = readFileSync(join(dir, f), "utf8");
  const heads = t
    .split(/\n/)
    .map((l) => l.match(/^## \[module:([a-z-]+)\]/)?.[1])
    .filter(Boolean);
  const miss = need.filter((h) => !heads.includes(h));
  const legacy = t.split(/\n/).filter(line => /^## (?!\[module:)/.test(line));
  if (!miss.length && !legacy.length) ok++;
  else bad.push({ f, miss, legacy });
}
console.log(`schema_ok ${ok} of ${files.length}`);
if (bad.length) console.log(JSON.stringify(bad, null, 2));
if (bad.length) process.exitCode = 1;
