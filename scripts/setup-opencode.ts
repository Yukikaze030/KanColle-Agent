/**
 * setup-opencode.ts — write/refresh OpenCode-facing pointers.
 * Agents and skills already live in .opencode/. This script validates them
 * and prints the token / env vars the user must set.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const agents = [".opencode/agents/kancolle.md", ".opencode/agents/kcwiki-researcher.md"];
const skills = [
  "kancolle-main",
  "quest-planner",
  "fleet-builder",
  "equipment-planner",
  "progression-planner",
  "event-guide",
  "combat-knowledge",
];

let ok = true;
for (const a of agents) {
  if (!existsSync(join(root, a))) {
    console.error(`MISSING agent: ${a}`);
    ok = false;
  } else console.log(`OK agent: ${a}`);
}
for (const s of skills) {
  const p = join(root, ".opencode/skills", s, "SKILL.md");
  if (!existsSync(p)) {
    console.error(`MISSING skill: ${s}`);
    ok = false;
  } else {
    const text = readFileSync(p, "utf8");
    console.log(`OK skill: ${s} (${text.length} chars)`);
  }
}

if (!existsSync(join(root, "opencode.jsonc"))) {
  console.error("MISSING opencode.jsonc");
  ok = false;
}

console.log(`
Next steps:
1. npm install && npm run build
2. Start Poi plugin (or: npm run start -w poi-plugin-kancolle-mcp for mock)
3. Set env KANCOLLE_POI_MCP_TOKEN from packages/poi-plugin-mcp/token.json
4. Open this folder in OpenCode — agents/skills/MCP auto-discovered via opencode.jsonc
`);

if (!ok) process.exit(1);
