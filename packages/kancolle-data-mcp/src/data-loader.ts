import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type {
  DatasetStatus,
  MasterEquipment,
  MasterExpedition,
  MasterMap,
  MasterQuest,
  MasterShip,
  MasterItem,
  RemodelTransition,
} from "@kancolle-agent/shared";

export interface EquipableRule {
  stype_ids: number[];
  slots: Array<"normal" | "reinforcement" | "land_base">;
}

export interface RawDataset {
  ships: MasterShip[];
  items?: MasterItem[];
  remodel_transitions?: RemodelTransition[];
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
    commit?: string;
    era?: string;
    era_name?: string;
    generated_at?: string;
    sources?: Record<string, string>;
    quest_source?: string;
    notes?: string[];
  };
}

export interface LoadedDataset extends DatasetStatus {
  ships: MasterShip[];
  items: MasterItem[];
  remodel_transitions: RemodelTransition[] | null;
  equipment: MasterEquipment[];
  quests: MasterQuest[];
  expeditions: MasterExpedition[];
  maps: MasterMap[];
  equipableByCategory: Record<string, EquipableRule>;
}

function packageRoots(): string[] {
  // dist/ and src/ both sit under packages/kancolle-data-mcp
  return [
    join(dirname(fileURLToPath(import.meta.url)), ".."),
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
  return findFile(join("data", "official", "dataset.json"));
}

function fixtureDatasetPath(): string {
  const p = findFile(join("data", "fixtures", "kancolle.json"));
  if (p) return p;
  return join(process.cwd(), "packages", "kancolle-data-mcp", "data", "fixtures", "kancolle.json");
}

/** Reject corrupt transition data instead of turning it into valid-looking advice. */
function validateRemodelData(raw: RawDataset): void {
  if (raw.remodel_transitions === undefined) return; // Legacy datasets are served as partial.
  if (!Array.isArray(raw.remodel_transitions)) throw new Error("Invalid remodel_transitions");
  const refs = new Set(raw.ships.map(ship => `ship:${ship.id}`));
  const pairs = new Set<string>();
  const validCount = (n: unknown) => n === null || (typeof n === "number" && Number.isSafeInteger(n) && n >= 0);
  for (const edge of raw.remodel_transitions) {
    const pair = `${edge.from}->${edge.to}`;
    if (!refs.has(edge.from) || !refs.has(edge.to) || pairs.has(pair)) throw new Error(`Invalid remodel edge ${pair}`);
    pairs.add(pair);
    const requiredResources = ["ammo", "steel", "development_material", "instant_construction", "improvement_material"];
    if (!validCount(edge.level) || !edge.resources || !requiredResources.every(key => key in edge.resources) || !Object.values(edge.resources).every(validCount)
      || !Array.isArray(edge.items) || !Array.isArray(edge.equipment)
      || !Array.isArray(edge.missing) || !Array.isArray(edge.sources)
      || !["complete", "partial"].includes(edge.coverage)) throw new Error(`Invalid remodel costs ${pair}`);
    for (const [kind, entries] of [["item", edge.items], ["equipment", edge.equipment]] as const) {
      for (const entry of entries) if (!new RegExp(`^${kind}:\\d+$`).test(entry.ref) || !validCount(entry.count)) {
        throw new Error(`Invalid remodel cost ref/count ${pair}`);
      }
    }
    const unknown = edge.level === null || Object.values(edge.resources).some(v => v === null)
      || [...edge.items, ...edge.equipment].some(v => v.count === null);
    if ((unknown || edge.missing.length) && edge.coverage === "complete") throw new Error(`Unknown costs marked complete ${pair}`);
    if (edge.coverage === "partial" && !edge.missing.length) throw new Error(`Partial costs need missing fields ${pair}`);
  }
}

function fromRaw(
  raw: RawDataset,
  sourcePath: string,
  name: string,
  version: string,
  commit: string | undefined,
): LoadedDataset {
  validateRemodelData(raw);
  return {
    name,
    version,
    era: raw.meta?.era ?? "2",
    commit,
    loaded_at: new Date().toISOString(),
    source: sourcePath,
    provenance: raw.meta?.sources,
    warnings: raw.meta?.notes,
    counts: {
      ships: raw.ships.length,
      items: raw.items?.length ?? 0,
      remodel_transitions: raw.remodel_transitions?.length ?? 0,
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
      ...(raw.meta?.era ? [`era:${raw.meta.era}`] : []),
      ...(raw.items ? ["items"] : []),
      ...(raw.remodel_transitions ? ["remodel_costs"] : []),
    ],
    ships: raw.ships,
    items: raw.items ?? [],
    remodel_transitions: raw.remodel_transitions ?? null,
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
export function loadDataset(explicitPath = process.env.KANCOLLE_DATA_PATH): LoadedDataset {
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
      raw.meta?.commit,
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
        raw.meta?.commit,
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
