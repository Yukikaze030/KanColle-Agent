import {
  okResult,
  poiError,
  poiPartial,
  snapshotMeta,
  type PoiResult,
} from "@kancolle-agent/shared";
import type { SnapshotStore } from "./snapshot.js";
import {
  getFleets,
  getInventory,
  getOperations,
  getOverview,
  getQuests,
  getStatus,
  queryEquipment,
  queryShips,
  type QueryEquipmentArgs,
  type QueryShipsArgs,
} from "./services.js";

function withMeta<T>(store: SnapshotStore, result: PoiResult<T>): PoiResult<T> {
  return {
    ...result,
    snapshot: snapshotMeta(store.get()),
  };
}

export function poiStatus(store: SnapshotStore): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.online) {
    return withMeta(store, {
      status: "not_ready",
      data: getStatus(snap),
      warnings: ["Poi offline or plugin not connected"],
    });
  }
  return withMeta(store, okResult(getStatus(snap)));
}

export function poiGetOverview(store: SnapshotStore): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) {
    return withMeta(store, {
      status: "not_ready",
      data: null,
      warnings: ["player not logged in"],
    });
  }
  const overview = getOverview(snap);
  if (overview.resources_coverage === "not_loaded") {
    return withMeta(store, poiPartial(overview, ["resources"]));
  }
  return withMeta(store, okResult(overview));
}

export function poiQueryShips(store: SnapshotStore, args: QueryShipsArgs): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  if (snap.freshness.find((f) => f.domain === "ships")?.updated_at == null) {
    return withMeta(store, {
      status: "not_ready",
      data: null,
      warnings: ["ships domain not loaded"],
    });
  }
  const result = queryShips(snap, args);
  if (result.mode === "instances" && result.total === 0 && result.items.length === 0) {
    // filters matched nothing — not an error
    return withMeta(store, okResult(result));
  }
  return withMeta(store, okResult(result));
}

export function poiQueryEquipment(
  store: SnapshotStore,
  args: QueryEquipmentArgs,
): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  if (snap.freshness.find((f) => f.domain === "equipment")?.updated_at == null) {
    return withMeta(store, {
      status: "not_ready",
      data: null,
      warnings: ["equipment domain not loaded"],
    });
  }
  return withMeta(store, okResult(queryEquipment(snap, args)));
}

export function poiQueryFleetAssets(
  store: SnapshotStore,
  args: {
    ships?: Pick<QueryShipsArgs, "master_ids" | "stype_ids" | "level" | "damage" | "dock" | "fleet_ids" | "limit">;
    equipment?: Pick<QueryEquipmentArgs, "master_ids" | "type_ids" | "mode" | "limit"> & { equipped?: "any" | "free" | "equipped" };
  },
): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  if (!args.ships && !args.equipment) {
    return withMeta(store, poiError("invalid_args", "provide ships and/or equipment selector"));
  }
  if (args.ships && !args.ships.master_ids?.length && !args.ships.stype_ids?.length) {
    return withMeta(store, poiError("invalid_args", "ships selector requires master_ids or stype_ids"));
  }
  if (args.equipment && !args.equipment.master_ids?.length && !args.equipment.type_ids?.length) {
    return withMeta(store, poiError("invalid_args", "equipment selector requires master_ids or type_ids"));
  }
  const shipsLoaded = snap.freshness.find(f => f.domain === "ships")?.updated_at != null;
  const equipmentLoaded = snap.freshness.find(f => f.domain === "equipment")?.updated_at != null;
  const missing: string[] = [];
  if (args.ships && !shipsLoaded) missing.push("ships");
  if (args.equipment && !equipmentLoaded) missing.push("equipment");
  const equipmentResult = args.equipment && equipmentLoaded
    ? queryEquipment(snap, {
      master_ids: args.equipment.master_ids,
      type_ids: args.equipment.type_ids,
      equipped: args.equipment.equipped === "any" || args.equipment.equipped === undefined
        ? undefined : args.equipment.equipped === "equipped",
      mode: args.equipment.mode ?? "aggregate",
      fields: ["instance_id", "master_id", "master_ref", "name", "type_id", "improvement", "proficiency", "equipped_on"],
      limit: args.equipment.limit ?? 30,
    }) : null;
  if (equipmentResult?.mode === "aggregate") {
    const limit = args.equipment?.limit ?? 30;
    Object.assign(equipmentResult, {
      truncated: equipmentResult.items.length > limit,
      items: equipmentResult.items.slice(0, limit),
    });
  }
  const data = {
    ships: args.ships && shipsLoaded
      ? queryShips(snap, {
        ...args.ships,
        mode: "instances",
        fields: ["instance_id", "master_id", "master_ref", "name", "stype_id", "level", "damage", "condition", "dock", "fleet_id", "slot_items"],
        limit: args.ships.limit ?? 30,
      }) : null,
    equipment: equipmentResult,
  };
  return missing.length ? withMeta(store, poiPartial(data, missing)) : withMeta(store, okResult(data));
}

export function poiGetFleets(store: SnapshotStore): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  return withMeta(store, okResult(getFleets(snap)));
}

export function poiGetQuests(
  store: SnapshotStore,
  args: { state?: string; limit?: number },
): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  return withMeta(store, okResult(getQuests(snap, args)));
}

export function poiGetInventory(store: SnapshotStore): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  const inv = getInventory(snap);
  if (inv.materials_coverage === "not_loaded" && inv.useitems_coverage === "not_loaded") {
    return withMeta(store, {
      status: "not_ready",
      data: inv,
      missing: ["materials", "useitems"],
      warnings: ["inventory not loaded — do not treat counts as 0"],
    });
  }
  if (inv.materials_coverage !== "complete" || inv.useitems_coverage !== "complete") {
    const missing: string[] = [];
    if (inv.materials_coverage !== "complete") missing.push("materials");
    if (inv.useitems_coverage !== "complete") missing.push("useitems");
    return withMeta(store, poiPartial(inv, missing));
  }
  return withMeta(store, okResult(inv));
}

export function poiGetOperations(store: SnapshotStore): PoiResult<unknown> {
  const snap = store.get();
  if (!snap.player_logged_in) return withMeta(store, poiError("not_ready", "player not logged in"));
  return withMeta(store, okResult(getOperations(snap)));
}

export function poiQueryShipsById(store: SnapshotStore, masterIds: number[]): PoiResult<unknown> {
  const result = poiQueryShips(store, { master_ids: masterIds, mode: "instances" });
  return result;
}
