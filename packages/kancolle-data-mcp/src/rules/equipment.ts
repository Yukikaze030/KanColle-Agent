import type { MasterShip } from "@kancolle-agent/shared";
import type { EquipableRule, LoadedDataset } from "../data-loader.js";
import type { MemoryIndex } from "../index-memory.js";

export interface EquipRuleResult {
  ship_ref: string;
  ship_name: string;
  equipment_ref: string;
  equipment_name: string;
  can_equip: boolean;
  slot: "normal" | "reinforcement" | "land_base" | "none";
  reason: string;
  category: string;
}

function equipableRule(
  ds: LoadedDataset,
  category: string | undefined,
): EquipableRule | null {
  if (!category) return null;
  return ds.equipableByCategory[category] ?? null;
}

export function canShipEquip(
  ds: LoadedDataset,
  ship: MasterShip,
  equipmentCategory: string | undefined,
  stypeId: number | undefined,
): EquipRuleResult {
  const category = equipmentCategory ?? "unknown";
  const rule = equipableRule(ds, category);
  const refShip = `ship:${ship.id}` as const;
  if (!rule) {
    return {
      ship_ref: refShip,
      ship_name: ship.name,
      equipment_ref: "",
      equipment_name: "",
      can_equip: false,
      slot: "none",
      reason: `unknown_category:${category}`,
      category,
    };
  }
  const sid = stypeId ?? ship.stype_id ?? -1;
  const can = rule.stype_ids.includes(sid);
  return {
    ship_ref: refShip,
    ship_name: ship.name,
    equipment_ref: "",
    equipment_name: "",
    can_equip: can,
    slot: can ? (rule.slots[0] ?? "normal") : "none",
    reason: can
      ? `stype_id=${sid} in allowlist for ${category}`
      : `stype_id=${sid} not in allowlist for ${category}`,
    category,
  };
}

export function whoCanEquip(
  ds: LoadedDataset,
  index: MemoryIndex,
  category: string,
  limit: number,
): Array<{ ref: string; name: string; stype: string }> {
  const rule = equipableRule(ds, category);
  if (!rule) return [];
  const out: Array<{ ref: string; name: string; stype: string }> = [];
  for (const ship of index.shipsById.values()) {
    const sid = ship.stype_id ?? -1;
    if (rule.stype_ids.includes(sid)) {
      out.push({ ref: `ship:${ship.id}`, name: ship.name, stype: ship.stype });
      if (out.length >= limit) break;
    }
  }
  return out;
}
