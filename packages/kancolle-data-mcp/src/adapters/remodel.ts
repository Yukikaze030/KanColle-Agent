import type { MasterItem, RemodelTransition } from "@kancolle-agent/shared";

export type ApiRow = Record<string, any>;
export interface RemodelRules {
  calcDevMat(steel: number, ship: number, blueprints: number): number;
  calcTorch(ship: number): number;
  calcGunMat(ship: number): number;
  calcScrew(ship: number): number;
  calcArsenalMat(ship: number): number;
}

// API field -> consumable master ID. Boiler is equipment, never a useitem.
const ITEM_FIELDS: Record<string, number> = {
  api_drawing_count: 58,
  api_catapult_count: 65,
  api_report_count: 78,
  api_aviation_mat_count: 77,
  api_arms_mat_count: 94,
  api_tech_count: 100,
};
const ITEM_ALIASES: Record<number, string[]> = {
  58: ["改装设计图"], 65: ["试制甲板用弹射器"], 75: ["新型火炮兵装资材", "新型砲熕兵装资材"],
  77: ["新型航空兵装资材"], 78: ["战斗详报"], 94: ["新型兵装资材"],
  100: ["海外舰最新技术"], 104: ["工厂资源", "工廠资源"],
};
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function normalizeItems(rows: ApiRow[]): MasterItem[] {
  return rows.map(row => ({
    id: row.api_id, name: row.api_name, alias: ITEM_ALIASES[row.api_id],
    description: (row.api_description ?? []).join(" ").replace(/<br\s*\/?\s*>/gi, " ").trim(),
  }));
}

export function buildRemodelTransitions(
  ships: ApiRow[], upgrades: ApiRow[] | undefined, items: MasterItem[],
  equipment: ApiRow[], rules: RemodelRules | undefined,
): RemodelTransition[] {
  const shipIds = new Set(ships.map(s => s.api_id));
  if (shipIds.size !== ships.length || ships.some(s => !Number.isSafeInteger(s.api_id) || s.api_id <= 0)) {
    throw new Error("Duplicate or invalid ship IDs");
  }
  const itemMap = new Map(items.map(i => [i.id, i]));
  const equipMap = new Map(equipment.map(e => [e.api_id, e.api_name as string]));
  const result: RemodelTransition[] = [];
  for (const ship of ships) {
    const to = Number(ship.api_aftershipid);
    // A terminal ship has an explicit zero, not a missing/invalid target.
    if (!/^[0-9]+$/.test(String(ship.api_aftershipid)) || !Number.isSafeInteger(to) || to < 0) {
      throw new Error(`Invalid remodel target for ship:${ship.api_id}`);
    }
    if (!to) continue;
    if (!shipIds.has(to)) throw new Error(`Missing remodel target ship:${to} from ship:${ship.api_id}`);
    const matching = upgrades?.filter(u => u.api_current_ship_id === ship.api_id) ?? [];
    if (matching.length > 1) throw new Error(`Duplicate upgrade rows for ship:${ship.api_id}`);
    const upgrade = matching[0];
    if (upgrade && Number(upgrade.api_id) !== to) throw new Error(`Conflicting upgrade target for ship:${ship.api_id}`);
    const edge: RemodelTransition = {
      from: `ship:${ship.api_id}`, to: `ship:${to}`, level: count(ship.api_afterlv),
      resources: { ammo: count(ship.api_afterbull), steel: count(ship.api_afterfuel) },
      items: [], equipment: [], coverage: "complete", missing: [], sources: ["master"],
    };
    if (edge.level === null) edge.missing.push("level");
    if (upgrade) for (const [field, value] of Object.entries(upgrade)) {
      if (field.endsWith("_count") && !(field in ITEM_FIELDS) && field !== "api_boiler_count" && value !== 0) {
        edge.missing.push(`unmapped:${field}`);
      }
    }
    const addItem = (id: number, quantity: number | null) => {
      if (quantity === 0) return;
      const item = itemMap.get(id);
      edge.items.push({ ref: `item:${id}`, name: item?.name ?? `item:${id}`, count: quantity });
      if (!item) edge.missing.push(`item:${id}.identity`);
      if (quantity === null) edge.missing.push(`item:${id}.count`);
    };
    for (const [field, id] of Object.entries(ITEM_FIELDS)) {
      // An absent row in a supplied complete master table means no special requirement.
      // A missing table or missing required field is unknown, not zero.
      addItem(id, !upgrades ? null : !upgrade ? 0 : count(upgrade[field]));
    }
    // This optional API field is omitted for zero by the game (unlike the fields above).
    const boiler = !upgrades ? null : count(upgrade?.api_boiler_count ?? 0);
    if (boiler !== 0) {
      edge.equipment.push({ ref: "equipment:87", name: equipMap.get(87) ?? "equipment:87", count: boiler });
      if (boiler === null) edge.missing.push("equipment:87.count");
      if (!equipMap.has(87)) edge.missing.push("equipment:87.identity");
    }
    const blueprints = !upgrades ? null : !upgrade ? 0 : count(upgrade.api_drawing_count);
    edge.resources.development_material = rules && blueprints !== null && edge.resources.steel !== null
      ? count(rules.calcDevMat(edge.resources.steel, ship.api_id, blueprints)) : null;
    edge.resources.instant_construction = rules ? count(rules.calcTorch(ship.api_id)) : null;
    edge.resources.improvement_material = rules ? count(rules.calcScrew(ship.api_id)) : null;
    addItem(75, rules ? count(rules.calcGunMat(ship.api_id)) : null);
    addItem(104, rules ? count(rules.calcArsenalMat(ship.api_id)) : null);
    if (rules) edge.sources.push("kc3-remodel");
    for (const [key, value] of Object.entries(edge.resources)) if (value === null) edge.missing.push(`resources.${key}`);
    edge.coverage = edge.missing.length ? "partial" : "complete";
    result.push(edge);
  }
  return result;
}
