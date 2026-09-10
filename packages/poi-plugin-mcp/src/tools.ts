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
  return withMeta(store, okResult(queryEquipment(snap, args)));
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
