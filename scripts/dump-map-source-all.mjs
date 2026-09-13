import { spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const mapsDir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const ids = readdirSync(mapsDir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .map((f) => f.replace(".md", ""))
  .sort((a, b) => {
    const [aa, ab] = a.split("-").map(Number);
    const [ba, bb] = b.split("-").map(Number);
    return aa - ba || ab - bb;
  });

const only = process.argv.slice(2);
const list = only.length ? only : ids;
console.log("dump", list.length, "maps");

const results = [];
for (const id of list) {
  process.stdout.write(`${id} `);
  const r = spawnSync(process.execPath, ["scripts/dump-map-source.mjs", id], {
    encoding: "utf8",
    timeout: 60000,
    cwd: process.cwd(),
  });
  const line = (r.stdout || "").trim().split("\n").pop() || "";
  console.log(line);
  results.push({ id, out: line, err: (r.stderr || "").slice(0, 80) });
}
console.log("\ndone", results.length);
