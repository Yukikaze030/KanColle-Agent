import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ImprovementMaterialCost {
  normal: number | null;
  guaranteed: number | null;
}

export interface ImprovementStage {
  development_material: ImprovementMaterialCost | null;
  improvement_material: ImprovementMaterialCost | null;
  consumables: Array<{ equipment_id: number; source_name: string; amount: number }>;
}

export interface ImprovementRecord {
  equipment_id: number;
  source_name: string;
  upgrade_to: { equipment_id: number; source_name: string } | null;
  assistant_required: boolean;
  assistant_ships: Array<{ ship_id: number; source_name: string }>;
  resources: { fuel: number; ammo: number; steel: number; bauxite: number };
  stages: { low: ImprovementStage | null; high: ImprovementStage | null; upgrade: ImprovementStage | null };
  weekdays: number[];
}

export interface ImprovementDataset {
  meta: {
    source: string;
    fetched_at: string;
    timezone: "Asia/Tokyo";
    weekday_names: string[];
    notes?: string[];
  };
  records: ImprovementRecord[];
}

function candidatePaths(): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return [
    process.env.KANCOLLE_IMPROVEMENT_DATA_PATH,
    join(moduleDir, "..", "data", "official", "improvements.json"),
    join(process.cwd(), "packages", "kancolle-data-mcp", "data", "official", "improvements.json"),
    join(process.cwd(), "data", "official", "improvements.json"),
  ].filter((value): value is string => Boolean(value));
}

export function loadImprovementData(): ImprovementDataset | null {
  const path = candidatePaths().find(existsSync);
  if (!path) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ImprovementDataset;
  if (!parsed.meta?.source || parsed.meta.timezone !== "Asia/Tokyo" || !Array.isArray(parsed.records)) {
    throw new Error("Invalid improvement dataset metadata");
  }
  for (const record of parsed.records) {
    if (!Number.isSafeInteger(record.equipment_id) || !Array.isArray(record.weekdays)
      || record.weekdays.some(day => !Number.isSafeInteger(day) || day < 0 || day > 6)
      || !Array.isArray(record.assistant_ships)
      || record.assistant_ships.some(ship => !Number.isSafeInteger(ship.ship_id))) {
      throw new Error(`Invalid improvement record: ${record.equipment_id}`);
    }
  }
  return parsed;
}

export function tokyoWeekday(date?: string): number {
  const instant = date ? new Date(`${date}T12:00:00+09:00`) : new Date();
  if (Number.isNaN(instant.getTime())) throw new Error("invalid_date");
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" })
    .format(instant)
    .toLowerCase();
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(short);
  if (day < 0) throw new Error("invalid_tokyo_weekday");
  return day;
}
