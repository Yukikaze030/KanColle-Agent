import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DatasetStatus,
  MasterEquipment,
  MasterExpedition,
  MasterMap,
  MasterQuest,
  MasterShip,
} from "@kancolle-agent/shared";

export interface EquipableRule {
  stype_ids: number[];
  slots: Array<"normal" | "reinforcement" | "land_base">;
}

export interface RawDataset {
  ships: MasterShip[];
  equipment: MasterEquipment[];
  quests: MasterQuest[];
  expeditions: MasterExpedition[];
  maps: MasterMap[];
  equipment_equipable?: {
    by_category: Record<string, EquipableRule>;
  };
}

export interface LoadedDataset extends DatasetStatus {
  ships: MasterShip[];
  equipment: MasterEquipment[];
  quests: MasterQuest[];
  expeditions: MasterExpedition[];
  maps: MasterMap[];
  equipableByCategory: Record<string, EquipableRule>;
}

const HERE = dirname(fileURLToPath(import.meta.url));

function defaultFixturePath(): string {
  // dist/ -> packages/kancolle-data-mcp/
  const candidates = [
    join(HERE, "..", "data", "fixtures", "kancolle.json"),
    join(HERE, "..", "..", "data", "fixtures", "kancolle.json"),
    join(process.cwd(), "packages", "kancolle-data-mcp", "data", "fixtures", "kancolle.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export function loadDataset(explicitPath?: string): LoadedDataset {
  const path = explicitPath ?? process.env.KANCOLLE_DATA_PATH ?? defaultFixturePath();
  if (!existsSync(path)) {
    throw new Error(
      `Data MCP fixture not found at ${path}. Set KANCOLLE_DATA_PATH or install fixtures.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawDataset;
  const loaded_at = new Date().toISOString();
  return {
    name: "kancolle-fixture-dataset",
    version: "1.0.0-fixture",
    commit: "local-fixtures",
    loaded_at,
    source: path,
    counts: {
      ships: raw.ships.length,
      equipment: raw.equipment.length,
      quests: raw.quests.length,
      expeditions: raw.expeditions.length,
      maps: raw.maps.length,
    },
    capabilities: [
      "search",
      "get",
      "query",
      "quest_graph",
      "ship_remodel",
      "equipment_rules",
    ],
    ships: raw.ships,
    equipment: raw.equipment,
    quests: raw.quests,
    expeditions: raw.expeditions,
    maps: raw.maps,
    equipableByCategory: raw.equipment_equipable?.by_category ?? {},
  };
}
