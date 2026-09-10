import { describe, expect, it, beforeEach } from "vitest";
import { SnapshotStore, aggregateEquipment, loadMockPlayer, normalizeShip } from "../src/snapshot.js";
import {
  poiGetFleets,
  poiGetInventory,
  poiGetOperations,
  poiGetOverview,
  poiGetQuests,
  poiQueryEquipment,
  poiQueryShips,
  poiStatus,
} from "../src/tools.js";
import { generateToken, isAuthorized, loadOrCreateToken } from "../src/auth.js";
import { createPoiRuntime } from "../src/plugin.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let store: SnapshotStore;

beforeEach(() => {
  store = new SnapshotStore();
  store.replace(loadMockPlayer());
});

describe("snapshot", () => {
  it("loads mock player with version bump on replace", () => {
    expect(store.get().version).toBeGreaterThan(0);
    expect(store.get().player_logged_in).toBe(true);
  });

  it("bumps version on domain update", () => {
    const v = store.version();
    store.setSortie({ active: true, map_ref: "map:5-5", fleet_ids: [1], node: "E" });
    expect(store.version()).toBe(v + 1);
  });

  it("observes quest completion without inventing history for absent quests", () => {
    store.observeQuestCompleted(999, "新任务");
    const q = store.get().quests.find((x) => x.game_id === 999);
    expect(q?.state).toBe("observed_completed");
    expect(q?.source).toBe("local_observed");
  });

  it("normalizes ship damage from hp ratio", () => {
    const s = normalizeShip({
      api_id: 1,
      api_ship_id: 699,
      api_lv: 90,
      api_nowhp: 20,
      api_maxhp: 53,
      api_cond: 49,
      api_locked: 1,
    });
    expect(s.damage).toBe("chuha");
    expect(s.master_ref).toBe("ship:699");
    const taiha = normalizeShip({
      api_id: 2,
      api_ship_id: 699,
      api_lv: 90,
      api_nowhp: 10,
      api_maxhp: 53,
    });
    expect(taiha.damage).toBe("taiha");
  });
});

describe("poi tools", () => {
  it("status reports domains", () => {
    const r = poiStatus(store);
    expect(r.status).toBe("ok");
    expect(r.snapshot?.version).toBe(store.version());
    expect((r.data as { domains: unknown[] }).domains.length).toBeGreaterThan(0);
  });

  it("overview includes resources and sortie flag", () => {
    const r = poiGetOverview(store);
    expect(r.status).toBe("ok");
    const data = r.data as { resources: { bucket: number }; sortie_active: boolean };
    expect(data.resources.bucket).toBe(186);
    expect(data.sortie_active).toBe(false);
  });

  it("query ships by master_id finds two Yahagi Kai Ni B", () => {
    const r = poiQueryShips(store, { master_ids: [699], mode: "instances" });
    expect(r.status).toBe("ok");
    const data = r.data as { total: number };
    expect(data.total).toBe(2);
  });

  it("query ships supports level filter and fields", () => {
    const r = poiQueryShips(store, {
      level: { min: 90 },
      mode: "instances",
      fields: ["instance_id", "level", "name"],
    });
    expect(r.status).toBe("ok");
    const data = r.data as { items: Array<{ level: number }> };
    expect(data.items.every((s) => s.level >= 90)).toBe(true);
  });

  it("equipment defaults to aggregate", () => {
    const r = poiQueryEquipment(store, { master_ids: [169] });
    expect(r.status).toBe("ok");
    const data = r.data as {
      mode: string;
      items: Array<{ count: number; improvements: Record<string, number> }>;
    };
    expect(data.mode).toBe("aggregate");
    expect(data.items[0].count).toBe(4);
    expect(data.items[0].improvements["+0"]).toBe(2);
    expect(data.items[0].improvements["+6"]).toBe(1);
    expect(data.items[0].improvements.MAX).toBe(1);
  });

  it("fleets return members", () => {
    const r = poiGetFleets(store);
    expect(r.status).toBe("ok");
    const data = r.data as { fleets: Array<{ id: number; members: unknown[] }> };
    expect(data.fleets).toHaveLength(4);
    expect(data.fleets[0].members.length).toBeGreaterThan(0);
  });

  it("quests return active and observed; absent is unknown", () => {
    const r = poiGetQuests(store, {});
    expect(r.status).toBe("ok");
    const data = r.data as { items: Array<{ game_id: number; state: string }>; note: string };
    expect(data.items.some((q) => q.game_id === 342 && q.state === "active")).toBe(true);
    expect(data.note).toContain("unknown");
    // B128 (424) not in list → unknown, not incomplete
    expect(data.items.some((q) => q.game_id === 424)).toBe(false);
  });

  it("inventory coverage complete", () => {
    const r = poiGetInventory(store);
    expect(r.status).toBe("ok");
    const data = r.data as { materials_coverage: string };
    expect(data.materials_coverage).toBe("complete");
  });

  it("inventory not_loaded does not claim zero", () => {
    store.patchDomain("inventory", {
      inventory: {
        materials: null,
        materials_coverage: "not_loaded",
        useitems: null,
        useitems_coverage: "not_loaded",
      },
    });
    const r = poiGetInventory(store);
    expect(r.status).toBe("not_ready");
    expect(r.data).not.toBeNull();
    expect((r.data as { materials: unknown }).materials).toBeNull();
  });

  it("operations include expeditions and last battle", () => {
    const r = poiGetOperations(store);
    expect(r.status).toBe("ok");
    const data = r.data as {
      expeditions: unknown[];
      last_battle: { result: string } | null;
    };
    expect(data.expeditions.length).toBe(2);
    expect(data.last_battle?.result).toBe("A");
  });

  it("pagination cursor works on ships", () => {
    const first = poiQueryShips(store, { mode: "instances", limit: 3 });
    const d1 = first.data as { items: unknown[]; cursor: string | null };
    expect(d1.items).toHaveLength(3);
    expect(d1.cursor).not.toBeNull();
    const second = poiQueryShips(store, { mode: "instances", limit: 3, cursor: d1.cursor! });
    const d2 = second.data as { items: Array<{ instance_id: number }> };
    expect(d2.items[0].instance_id).not.toBe((d1.items[0] as { instance_id: number }).instance_id);
  });
});

describe("aggregateEquipment helper", () => {
  it("groups by master and improvement bucket", () => {
    const snap = loadMockPlayer();
    const agg = aggregateEquipment(snap.equipment.filter((e) => e.master_id === 39));
    expect(agg[0].count).toBe(2);
    expect(agg[0].improvements["+6"]).toBe(1);
  });
});

describe("auth", () => {
  it("accepts matching bearer token", () => {
    const token = generateToken();
    expect(isAuthorized(`Bearer ${token}`, token)).toBe(true);
    expect(isAuthorized("Bearer wrong", token)).toBe(false);
    expect(isAuthorized(undefined, token)).toBe(false);
  });

  it("persists token file", () => {
    const dir = mkdtempSync(join(tmpdir(), "poi-token-"));
    const path = join(dir, "token.json");
    try {
      const a = loadOrCreateToken(path);
      const b = loadOrCreateToken(path);
      expect(a.token).toBe(b.token);
      expect(a.token).toHaveLength(64);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runtime api event adapter", () => {
  it("updates resources and ships from api_port/port", () => {
    const runtime = createPoiRuntime();
    runtime.store.setOnline(true, true);
    runtime.handleApiEvent("/kcsapi/api_port/port", {
      api_material: [
        { api_id: 1, api_value: 100 },
        { api_id: 2, api_value: 200 },
        { api_id: 3, api_value: 300 },
        { api_id: 4, api_value: 400 },
        { api_id: 5, api_value: 10 },
        { api_id: 6, api_value: 5 },
        { api_id: 7, api_value: 20 },
        { api_id: 8, api_value: 3 },
      ],
      api_ship: [
        {
          api_id: 1,
          api_ship_id: 699,
          api_lv: 98,
          api_nowhp: 53,
          api_maxhp: 53,
          api_cond: 49,
          api_locked: 1,
        },
      ],
    });
    const snap = runtime.store.get();
    expect(snap.resources?.fuel).toBe(100);
    expect(snap.ships[0].master_id).toBe(699);
  });
});
