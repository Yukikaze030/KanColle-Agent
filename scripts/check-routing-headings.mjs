import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const files = readdirSync(dir).filter((f) => /^[1-7]-[1-6]\.md$/.test(f));
let ok = 0;
const miss = [];
for (const f of files) {
  const t = readFileSync(join(dir, f), "utf8");
  if (/^## 带路条件/m.test(t)) ok++;
  else miss.push(f);
}
console.log(`with 带路条件 ${ok} of ${files.length}`);
if (miss.length) console.log("missing", miss.join(","));
