import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SnapshotStore } from "./snapshot.js";
import {
  poiGetFleets,
  poiGetInventory,
  poiGetOperations,
  poiGetOverview,
  poiGetQuests,
  poiQueryEquipment,
  poiQueryShips,
  poiStatus,
} from "./tools.js";

function toText(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

const damageEnum = z.enum([
  "healthy",
  "shouha",
  "chuha",
  "heavily_damaged",
  "taiha",
  "unknown",
]);

export function createPoiMcpServer(store: SnapshotStore): McpServer {
  const server = new McpServer({ name: "kancolle-poi-mcp", version: "1.0.0" });

  server.tool(
    "poi_status",
    "Poi online status, player login, snapshot version, and per-domain freshness.",
    {},
    async () => toText(poiStatus(store)),
  );

  server.tool(
    "poi_get_overview",
    "Compact overview: resources, buckets, capacities, quest/expedition/dock counts, sortie flag.",
    {},
    async () => toText(poiGetOverview(store)),
  );

  server.tool(
    "poi_query_ships",
    "Query player ships. Filters: instance_ids/master_ids/fleet_ids/level/locked/damage/condition/dock. mode=aggregate avoids dumping instances. Supports fields, limit, cursor (max 100).",
    {
      instance_ids: z.array(z.number()).optional(),
      master_ids: z.array(z.number()).optional(),
      fleet_ids: z.array(z.number()).optional(),
      level: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
      locked: z.boolean().optional(),
      damage: z.array(damageEnum).optional(),
      condition: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
      dock: z.boolean().optional(),
      mode: z.enum(["instances", "aggregate"]).optional(),
      fields: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    },
    async (args) => toText(poiQueryShips(store, args)),
  );

  server.tool(
    "poi_query_equipment",
    "Query player equipment. Default mode=aggregate (count by master + improvement). Avoids returning thousands of instances.",
    {
      instance_ids: z.array(z.number()).optional(),
      master_ids: z.array(z.number()).optional(),
      improvement: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
      proficiency: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
      locked: z.boolean().optional(),
      equipped: z.boolean().optional(),
      mode: z.enum(["aggregate", "instances"]).optional(),
      fields: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    },
    async (args) => toText(poiQueryEquipment(store, args)),
  );

  server.tool(
    "poi_get_fleets",
    "Fleets 1-4 with members, combined-fleet flags, and expedition assignment.",
    {},
    async () => toText(poiGetFleets(store)),
  );

  server.tool(
    "poi_get_quests",
    "Current quests + observed history. Absent quest = unknown, never assume incomplete.",
    {
      state: z.enum(["active", "observed_completed", "unknown", "available"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => toText(poiGetQuests(store, args)),
  );

  server.tool(
    "poi_get_inventory",
    "Materials and useitems with coverage flags (complete/partial/not_loaded). not_loaded ≠ 0.",
    {},
    async () => toText(poiGetInventory(store)),
  );

  server.tool(
    "poi_get_operations",
    "Expeditions, repairs, constructions, sortie state, and last battle result.",
    {},
    async () => toText(poiGetOperations(store)),
  );

  return server;
}
