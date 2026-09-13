/**
 * Batch extract routing for map ids given as args or default 1-1..4-5.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const mapsDir = join(process.cwd(), ".opencode/skills/fleet-builder/refs/maps");
const routingDir = join(mapsDir, "_routing");
mkdirSync(routingDir, { recursive: true });

const args = process.argv.slice(2);
let ids = args;
if (!ids.length) {
  ids = readdirSync(mapsDir)
    .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
    .map((f) => f.replace(".md", ""))
    .filter((id) => {
      const [a] = id.split("-").map(Number);
      return a <= 4;
    })
    .sort((x, y) => {
      const [xa, xb] = x.split("-").map(Number);
      const [ya, yb] = y.split("-").map(Number);
      return xa - ya || xb - yb;
    });
}

console.log("ids", ids.join(","));
const results = [];
for (const id of ids) {
  process.stdout.write(`fetch ${id} ... `);
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    const r = spawnSync(process.execPath, ["scripts/fetch-nga-routing-one.mjs", id], {
      encoding: "utf8",
      timeout: 45000,
      cwd: process.cwd(),
    });
    const out = (r.stdout || "") + (r.stderr || "");
    const jpath = join(routingDir, `${id}.json`);
    if (existsSync(jpath)) {
      try {
        const j = JSON.parse(readFileSync(jpath, "utf8"));
        if (j.hasRouting && j.routingChars >= 80) {
          ok = true;
          results.push({ id, hasRouting: j.routingChars, chars: j.routingChars });
          console.log("ok", j.routingChars);
        } else {
          console.log("thin", j.routingChars);
        }
      } catch {
        console.log("bad json");
      }
    } else {
      console.log("no file", out.slice(0, 120));
    }
  }
  if (!ok) {
    results.push({ id, error: "fail" });
    console.log("FAIL", id);
  }
}

console.log(JSON.stringify(results, null, 2));
