#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDataset } from "./data-loader.js";
import { buildIndex } from "./index-memory.js";
import {
  kcDataStatus,
  kcEquipmentRules,
  kcGet,
  kcQuestGraph,
  kcQuery,
  kcSearch,
  kcShipRemodel,
  type ToolContext,
} from "./tools.js";

function toText(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: "kancolle-data-mcp",
    version: "1.0.0",
  });

  server.tool(
    "kc_search",
    "Search ships/equipment/quests/expeditions/maps by name, alias, wiki id, game id, or ref. Returns small hit list (ref/name/type/score), not full entities.",
    {
      query: z.string().describe("Name, alias, wiki id, game id, or canonical ref"),
      limit: z.number().int().min(1).max(10).optional().describe("Default 5, max 10"),
      types: z
        .array(z.enum(["ship", "equipment", "quest", "expedition", "map"]))
        .optional(),
    },
    async (args) => toText(kcSearch(ctx, args)),
  );

  server.tool(
    "kc_get",
    "Fetch one master entity by canonical ref (ship:N, equipment:N, quest:N, expedition:N, map:A-M). Optional include: remodel|graph|all.",
    {
      ref: z.string(),
      include: z.array(z.string()).optional(),
    },
    async (args) => toText(kcGet(ctx, args)),
  );

  server.tool(
    "kc_query",
    "Structured filter over entity type with fields/limit/cursor. Use for lists like 轻巡 or firepower>=10 equipment.",
    {
      entity: z.enum(["ship", "equipment", "quest", "expedition", "map"]),
      filters: z.record(z.unknown()).optional(),
      fields: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    },
    async (args) => toText(kcQuery(ctx, args)),
  );

  server.tool(
    "kc_quest_graph",
    "Quest prerequisite/unlock graph. Returns only id/name/relations, not full quest bodies.",
    {
      quest: z.string().describe("quest ref, game id, wiki id (B128), or name"),
      direction: z.enum(["up", "down", "both"]).optional(),
      depth: z.number().int().min(1).max(5).optional(),
    },
    async (args) => toText(kcQuestGraph(ctx, args)),
  );

  server.tool(
    "kc_ship_remodel",
    "Ship remodel chain with remodel levels (e.g. 矢矧 → 矢矧改 → 矢矧改二乙).",
    {
      ship: z.string(),
    },
    async (args) => toText(kcShipRemodel(ctx, args)),
  );

  server.tool(
    "kc_equipment_rules",
    "Check if a ship can equip a category/equipment (mode=check), or list who can equip (mode=who). Rules computed inside MCP.",
    {
      ship: z.string().optional(),
      equipment: z.string().optional(),
      category: z.string().optional(),
      mode: z.enum(["check", "who"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => toText(kcEquipmentRules(ctx, args)),
  );

  server.tool(
    "kc_data_status",
    "Dataset version, commit, load time, counts, and capabilities. Use to judge staleness before claiming 'new quest not found'.",
    {},
    async () => toText(kcDataStatus(ctx)),
  );

  return server;
}

export async function main(): Promise<void> {
  const ds = loadDataset();
  const index = buildIndex(ds);
  const ctx: ToolContext = { ds, index };
  const server = createServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `kancolle-data-mcp ready: ships=${ds.counts.ships} equipment=${ds.counts.equipment} quests=${ds.counts.quests}`,
  );
}

const isDirect =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    import.meta.url.includes("kancolle-data-mcp"));

if (isDirect || process.env.KANCOLLE_DATA_MCP_FORCE_START === "1") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { createServer };
