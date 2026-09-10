/**
 * Post-install: ensure workspace builds and config exists.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "packages/shared/package.json",
  "packages/kancolle-data-mcp/package.json",
  "packages/poi-plugin-mcp/package.json",
  "config/kancolle.json",
  "opencode.jsonc",
];

let ok = true;
for (const r of required) {
  const p = join(root, r);
  if (!existsSync(p)) {
    console.error(`MISSING: ${r}`);
    ok = false;
  } else {
    console.log(`OK: ${r}`);
  }
}

if (!ok) {
  console.error("install check failed");
  process.exit(1);
}
console.log("install:all prerequisites present. Run: npm run build && npm test");
