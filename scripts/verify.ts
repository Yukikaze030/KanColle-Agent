/**
 * verify.ts — build + test + structural acceptance checks.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, shell: "powershell.exe" });
}

const tools = [
  // Poi
  "poi_status",
  "poi_get_overview",
  "poi_query_ships",
  "poi_query_equipment",
  "poi_get_fleets",
  "poi_get_quests",
  "poi_get_inventory",
  "poi_get_operations",
  // Data
  "kc_search",
  "kc_get",
  "kc_query",
  "kc_quest_graph",
  "kc_ship_remodel",
  "kc_equipment_rules",
  "kc_data_status",
];

console.log("== KanColle Agent verify ==");

// structural
const files = [
  "packages/shared/src/refs.ts",
  "packages/shared/src/result.ts",
  "packages/shared/src/types.ts",
  "packages/kancolle-data-mcp/src/index.ts",
  "packages/kancolle-data-mcp/src/tools.ts",
  "packages/poi-plugin-mcp/src/plugin.ts",
  "packages/poi-plugin-mcp/src/tools.ts",
  ".opencode/agents/kancolle.md",
  ".opencode/agents/kcwiki-researcher.md",
  "opencode.jsonc",
  "config/kancolle.json",
];
for (const f of files) {
  if (!existsSync(join(root, f))) {
    console.error(`STRUCT FAIL missing ${f}`);
    process.exit(1);
  }
}
console.log(`STRUCT OK: ${files.length} key files present`);
console.log(`TOOL CONTRACT: ${tools.length} MCP tools defined in design`);

run("npm run build");
run("npm test");

console.log("\nVERIFY PASS");
