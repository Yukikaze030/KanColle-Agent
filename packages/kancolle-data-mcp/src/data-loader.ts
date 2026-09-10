import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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
  meta?: {
    name?: string;
    version?: string;
    generated_at?: string;
    sources?: Record<string, string>;
    quest_source?: string;
    notes?: string[];
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

function packageRoots(): string[] {
  // dist/ and src/ both sit under packages/kancolle-data-mcp
  return [
    join(process.cwd(), "packages", "kancolle-data-mcp"),
    join(process.cwd()),
    join(process.cwd(), "kancolle-data-mcp"),
  ];
}

function findFile(rel: string): string | null {
  for (const root of packageRoots()) {
    const p = join(root, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

function officialDatasetPath(): string | null {
  return (
    findFile(join("data", "official", "dataset.json")) ??
    findFile(join("data", "official", "dataset.json"))
  );
}

function fixtureDatasetPath(): string {
  const p = findFile(join("data", "fixtures", "kancolle.json"));
  if (p) return p;
  return join(process.cwd(), "packages", "kancolle-data-mcp", "data", "fixtures", "kancolle.json");
}

function fromRaw(
  raw: RawDataset,
  sourcePath: string,
  name: string,
  version: string,
  commit: string | undefined,
): LoadedDataset {
  return {
    name,
    version,
    commit,
    loaded_at: new Date().toISOString(),
    source: sourcePath,
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

/**
 * Load dataset.
 * Priority:
 * 1. KANCOLLE_DATA_PATH (explicit JSON)
 * 2. official dataset (data/official/dataset.json) unless KANCOLLE_DATA_SOURCE=fixture
 * 3. local fixtures
 */
export function loadDataset(explicitPath?: string): LoadedDataset {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`KANCOLLE_DATA_PATH not found: ${explicitPath}`);
    }
    const raw = JSON.parse(readFileSync(explicitPath, "utf8")) as RawDataset;
    return fromRaw(
      raw,
      explicitPath,
      raw.meta?.name ?? "kancolle-explicit-dataset",
      raw.meta?.version ?? "0.0.0",
      raw.meta?.generated_at,
    );
  }

  const mode = (process.env.KANCOLLE_DATA_SOURCE ?? "official").toLowerCase();

  if (mode !== "fixture") {
    const official = officialDatasetPath();
    if (official && existsSync(official)) {
      const raw = JSON.parse(readFileSync(official, "utf8")) as RawDataset;
      return fromRaw(
        raw,
        official,
        raw.meta?.name ?? "kancolle-official-dataset",
        raw.meta?.version ?? "1.0.0-official",
        raw.meta?.generated_at,
      );
    }
  }

  const path = fixtureDatasetPath();
  if (!existsSync(path)) {
    throw new Error(
      `Data MCP dataset not found. Run: node scripts/fetch-official-data.mjs (official) or set KANCOLLE_DATA_PATH.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawDataset;
  return fromRaw(raw, path, "kancolle-fixture-dataset", "1.0.0-fixture", "local-fixtures");
}
