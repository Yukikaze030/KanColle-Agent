import {
  decodeCursor,
  pickFields,
  paginate,
  DEFAULT_LIMIT,
  type DamageState,
  type PlayerSnapshot,
} from "@kancolle-agent/shared";
import { aggregateEquipment } from "./snapshot.js";

export interface QueryShipsArgs {
  instance_ids?: number[];
  master_ids?: number[];
  fleet_ids?: number[];
  level?: { min?: number; max?: number };
  locked?: boolean;
  damage?: DamageState[];
  condition?: { min?: number; max?: number };
  dock?: boolean;
  mode?: "instances" | "aggregate";
  fields?: string[];
  limit?: number;
  cursor?: string;
}

export function queryShips(snap: PlayerSnapshot, args: QueryShipsArgs) {
  let ships = [...snap.ships];
  if (args.instance_ids?.length) {
    const set = new Set(args.instance_ids);
    ships = ships.filter((s) => set.has(s.instance_id));
  }
  if (args.master_ids?.length) {
    const set = new Set(args.master_ids);
    ships = ships.filter((s) => set.has(s.master_id));
  }
  if (args.fleet_ids?.length) {
    const set = new Set(args.fleet_ids);
    ships = ships.filter((s) => s.fleet_id != null && set.has(s.fleet_id));
  }
  if (args.level) {
    if (args.level.min != null) ships = ships.filter((s) => s.level >= args.level!.min!);
    if (args.level.max != null) ships = ships.filter((s) => s.level <= args.level!.max!);
  }
  if (args.locked != null) ships = ships.filter((s) => s.locked === args.locked);
  if (args.damage?.length) {
    const set = new Set(args.damage);
    ships = ships.filter((s) => set.has(s.damage));
  }
  if (args.condition) {
    if (args.condition.min != null) {
      ships = ships.filter((s) => s.condition >= args.condition!.min!);
    }
    if (args.condition.max != null) {
      ships = ships.filter((s) => s.condition <= args.condition!.max!);
    }
  }
  if (args.dock != null) ships = ships.filter((s) => Boolean(s.dock) === args.dock);

  const mode = args.mode ?? "instances";
  if (mode === "aggregate") {
    const byMaster = new Map<number, { master_id: number; name: string; count: number; max_level: number; min_level: number }>();
    for (const s of ships) {
      const row = byMaster.get(s.master_id) ?? {
        master_id: s.master_id,
        name: s.name,
        count: 0,
        max_level: 0,
        min_level: 999,
      };
      row.count += 1;
      row.max_level = Math.max(row.max_level, s.level);
      row.min_level = Math.min(row.min_level, s.level);
      byMaster.set(s.master_id, row);
    }
    return {
      mode: "aggregate" as const,
      total: ships.length,
      items: [...byMaster.values()],
    };
  }

  const { page, cursor, total } = paginate(ships, args.limit ?? DEFAULT_LIMIT, args.cursor);
  return {
    mode: "instances" as const,
    total,
    cursor,
    items: page.map((s) => pickFields(s, args.fields)),
  };
}

export interface QueryEquipmentArgs {
  instance_ids?: number[];
  master_ids?: number[];
  improvement?: { min?: number; max?: number };
  proficiency?: { min?: number; max?: number };
  locked?: boolean;
  equipped?: boolean;
  mode?: "aggregate" | "instances";
  fields?: string[];
  limit?: number;
  cursor?: string;
}

export function queryEquipment(snap: PlayerSnapshot, args: QueryEquipmentArgs) {
  let eq = [...snap.equipment];
  if (args.instance_ids?.length) {
    const set = new Set(args.instance_ids);
    eq = eq.filter((e) => set.has(e.instance_id));
  }
  if (args.master_ids?.length) {
    const set = new Set(args.master_ids);
    eq = eq.filter((e) => set.has(e.master_id));
  }
  if (args.improvement) {
    if (args.improvement.min != null) {
      eq = eq.filter((e) => e.improvement >= args.improvement!.min!);
    }
    if (args.improvement.max != null) {
      eq = eq.filter((e) => e.improvement <= args.improvement!.max!);
    }
  }
  if (args.proficiency) {
    if (args.proficiency.min != null) {
      eq = eq.filter((e) => e.proficiency >= args.proficiency!.min!);
    }
    if (args.proficiency.max != null) {
      eq = eq.filter((e) => e.proficiency <= args.proficiency!.max!);
    }
  }
  if (args.locked != null) eq = eq.filter((e) => e.locked === args.locked);
  if (args.equipped != null) {
    eq = eq.filter((e) => (e.equipped_on != null) === args.equipped);
  }

  const mode = args.mode ?? "aggregate";
  if (mode === "aggregate") {
    return {
      mode: "aggregate" as const,
      total: eq.length,
      items: aggregateEquipment(eq),
    };
  }

  const { page, cursor, total } = paginate(eq, args.limit ?? DEFAULT_LIMIT, args.cursor);
  return {
    mode: "instances" as const,
    total,
    cursor,
    items: page.map((e) => pickFields(e, args.fields)),
  };
}

export function getOverview(snap: PlayerSnapshot) {
  const res = snap.resources;
  const inv = snap.inventory;
  const activeQuests = snap.quests.filter((q) => q.state === "active").length;
  return {
    resources: res
      ? {
          fuel: res.fuel,
          ammo: res.ammo,
          steel: res.steel,
          bauxite: res.bauxite,
          bucket: res.bucket,
          development_material: res.development_material,
          improvement_material: res.improvement_material,
          instant_construction: res.instant_construction,
        }
      : null,
    resources_coverage: snap.resources ? ("complete" as const) : ("not_loaded" as const),
    inventory_coverage: {
      materials: inv.materials_coverage,
      useitems: inv.useitems_coverage,
    },
    ship_count: snap.ships.length,
    equipment_count: snap.equipment.length,
    ship_slots: snap.profile?.ship_slots ?? null,
    equipment_slots: snap.profile?.equipment_slots ?? null,
    active_quests: activeQuests,
    quest_records: snap.quests.length,
    expedition_count: snap.operations.expeditions.length,
    repair_count: snap.repairs.filter((r) => r.ship_instance_id != null).length,
    construction_count: snap.constructions.filter((c) => c.is_open).length,
    sortie_active: snap.operations.sortie.active,
  };
}

export function getFleets(snap: PlayerSnapshot) {
  return {
    fleets: snap.fleets.map((f) => ({
      id: f.id,
      name: f.name,
      is_combined: f.is_combined ?? false,
      combined_role: f.combined_role ?? null,
      expedition_id: f.expedition_id ?? null,
      mission_complete_at: f.mission_complete_at ?? null,
      members: f.members,
    })),
  };
}

export function getQuests(snap: PlayerSnapshot, args: { state?: string; limit?: number } = {}) {
  let quests = [...snap.quests];
  if (args.state) quests = quests.filter((q) => q.state === args.state);
  const { page, cursor, total } = paginate(quests, args.limit ?? DEFAULT_LIMIT);
  return {
    total,
    cursor,
    items: page,
    note: "Quest not present in snapshot means unknown, not incomplete.",
  };
}

export function getInventory(snap: PlayerSnapshot) {
  return {
    materials: snap.inventory.materials,
    materials_coverage: snap.inventory.materials_coverage,
    useitems: snap.inventory.useitems,
    useitems_coverage: snap.inventory.useitems_coverage,
    warning:
      snap.inventory.materials_coverage === "not_loaded"
        ? "materials not_loaded — do not treat as 0"
        : undefined,
  };
}

export function getOperations(snap: PlayerSnapshot) {
  return {
    expeditions: snap.operations.expeditions,
    repairs: snap.repairs,
    constructions: snap.constructions,
    sortie: snap.operations.sortie,
    last_battle: snap.operations.last_battle,
  };
}

export function getStatus(snap: PlayerSnapshot) {
  return {
    online: snap.online,
    player_logged_in: snap.player_logged_in,
    snapshot_version: snap.version,
    generated_at: snap.generated_at,
    domains: snap.freshness,
    domains_loaded: snap.freshness.map((f) => ({
      domain: f.domain,
      coverage: f.coverage ?? "complete",
      updated_at: f.updated_at,
    })),
  };
}

export function decodeLimit(cursor?: string, limit?: number): number {
  return Math.min(100, Math.max(1, limit ?? decodeCursor(cursor).limit ?? DEFAULT_LIMIT));
}
