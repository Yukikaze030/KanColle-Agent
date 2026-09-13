import type { MasterEquipment, MasterShip } from "@kancolle-agent/shared";
import type { EquipableRule, LoadedDataset } from "../data-loader.js";
import type { MemoryIndex } from "../index-memory.js";

export interface EquipRuleResult {
  ship_ref: string;
  ship_name: string;
  equipment_ref: string;
  equipment_name: string;
  can_equip: boolean | null;
  slots: Array<"normal" | "reinforcement">;
  reason: string;
  category: string;
  equipment_type_id?: number;
  coverage: "complete" | "partial";
  source: "api_start2" | "legacy_fixture" | "unknown";
}

function legacyRule(ds: LoadedDataset, category: string | undefined): EquipableRule | null {
  if (!category) return null;
  return ds.equipableByCategory[category] ?? null;
}

function reinforcementAllowed(ds: LoadedDataset, ship: MasterShip, equipment: MasterEquipment): boolean | null {
  const rules = ds.masterEquipRules;
  const typeId = equipment.type_id;
  if (!rules || typeId === undefined) return false;
  if ((rules.reinforcement_denied_by_ship[String(ship.id)] ?? []).includes(typeId)) return false;
  if (rules.reinforcement_default_types.includes(typeId)) return true;
  const special = rules.reinforcement_by_equipment[String(equipment.id)];
  if (!special) return false;
  const matches = special.ship_ids.includes(ship.id)
    || (ship.stype_id !== undefined && special.stype_ids.includes(ship.stype_id))
    || (ship.ctype_id !== undefined && special.ctype_ids.includes(ship.ctype_id));
  if (!matches) return false;
  return special.required_level > 0 ? null : true;
}

export function canShipEquip(
  ds: LoadedDataset,
  ship: MasterShip,
  equipment: MasterEquipment,
): EquipRuleResult {
  const base = {
    ship_ref: `ship:${ship.id}`,
    ship_name: ship.name,
    equipment_ref: `equipment:${equipment.id}`,
    equipment_name: equipment.name,
    category: equipment.category ?? "unknown",
  };
  const master = ds.masterEquipRules;
  if (master && equipment.type_id !== undefined && ship.stype_id !== undefined) {
    const allowed = master.normal_by_ship[String(ship.id)]
      ?? master.normal_by_stype[String(ship.stype_id)];
    if (!allowed) {
      return { ...base, can_equip: null, slots: [], reason: `missing_stype_rule:${ship.stype_id}`,
        equipment_type_id: equipment.type_id, coverage: "partial", source: "api_start2" };
    }
    const slots: Array<"normal" | "reinforcement"> = [];
    if (allowed.includes(equipment.type_id)) slots.push("normal");
    const reinforcement = reinforcementAllowed(ds, ship, equipment);
    if (reinforcement === true) slots.push("reinforcement");
    if (reinforcement === null && slots.length === 0) {
      return { ...base, can_equip: null, slots: [], reason: "reinforcement_rule_requires_player_level",
        equipment_type_id: equipment.type_id, coverage: "partial", source: "api_start2" };
    }
    return {
      ...base,
      can_equip: slots.length > 0,
      slots,
      reason: slots.length
        ? `equipment_type_id=${equipment.type_id} allowed by api_start2`
        : `equipment_type_id=${equipment.type_id} denied by api_start2`,
      equipment_type_id: equipment.type_id,
      coverage: "complete",
      source: "api_start2",
    };
  }

  const legacy = legacyRule(ds, equipment.category);
  if (!legacy) {
    return { ...base, can_equip: null, slots: [], reason: `unknown_category:${base.category}`,
      equipment_type_id: equipment.type_id, coverage: "partial", source: "unknown" };
  }
  const can = legacy.stype_ids.includes(ship.stype_id ?? -1);
  return {
    ...base,
    can_equip: can,
    slots: can ? legacy.slots.filter((slot): slot is "normal" | "reinforcement" => slot !== "land_base") : [],
    reason: `legacy stype_id=${ship.stype_id ?? -1} ${can ? "allowed" : "denied"} for ${base.category}`,
    equipment_type_id: equipment.type_id,
    coverage: "partial",
    source: "legacy_fixture",
  };
}

export function whoCanEquip(
  ds: LoadedDataset,
  index: MemoryIndex,
  equipment: MasterEquipment,
  limit: number,
): Array<{ ref: string; name: string; stype: string; slots: string[] }> {
  const out: Array<{ ref: string; name: string; stype: string; slots: string[] }> = [];
  for (const ship of index.shipsById.values()) {
    const result = canShipEquip(ds, ship, equipment);
    if (result.can_equip === true) {
      out.push({ ref: `ship:${ship.id}`, name: ship.name, stype: ship.stype, slots: result.slots });
      if (out.length >= limit) break;
    }
  }
  return out;
}
