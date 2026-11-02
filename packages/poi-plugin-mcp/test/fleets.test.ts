import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { FleetRecord, ShipRecord, EquipmentRecord } from "@kancolle-agent/shared";
import { SnapshotStore } from "../src/snapshot.js";
import { poiGetFleets, poiQueryEquipment, poiQueryShips } from "../src/tools.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPoiMcpServer } from "../src/mcp-server.js";

const require = createRequire(import.meta.url);
const bridge = require("../poi/store-bridge.cjs") as {
  syncFromPoi: (snapshot: SnapshotStore, raw: unknown) => void;
  readFleets: (raw: unknown) => FleetRecord[];
  readShips: (raw: unknown) => ShipRecord[];
  readEquipment: (raw: unknown) => EquipmentRecord[];
};

// Shape verified against installed Poi's views/redux/info/{index,fleets,ships}.js.
function poiState() {
  return {
    info: {
      basic: { api_level: 100 },
      fleets: [1, 2, 3, 4].map((id) => ({
        api_id: id, api_name: `测试舰队${id}`, api_ship: [id + 9, -1, -1, -1, -1, -1],
        api_mission: id === 3 ? [1, 37, 1800000000000, 0] : [0, 0, 0, 0],
      })),
      ships: Object.fromEntries([10, 11, 12, 13].map((id) => [id, {
        api_id: id, api_ship_id: 500, api_lv: 80, api_nowhp: 20, api_maxhp: 20,
        api_cond: 49, api_slot: id === 10 ? [20, -1, 21] : [-1],
        api_slot_ex: id === 10 ? 22 : id === 11 ? -1 : 0,
        api_onslot: id === 10 ? [2, 0, 0] : [0],
        api_onslot_max: id === 10 ? [4, 0, 0] : [0],
      }])),
      equips: Object.fromEntries([20, 21, 22, 23].map((id) => [id, {
        api_id: id, api_slotitem_id: 600, api_level: 6, api_alv: 7, api_locked: 1,
      }])),
      repairs: [{ api_id: 1, api_ship_id: 13, api_complete_time: 1800000000000 }],
      constructions: [],
    },
    const: {
      $ships: { 500: { api_name: "测试舰船", api_stype: 2, api_maxeq: [3, 0, 0] } },
      $equips: { 600: { api_name: "测试装备", api_type: [0, 0, 1] } },
    },
    sortie: { combinedFlag: 1 },
  };
}

function synced(raw: unknown = poiState()) {
  const store = new SnapshotStore();
  bridge.syncFromPoi(store, raw);
  return store;
}

describe("current Poi fleet bridge", () => {
  it("reads all four fleets and derives membership without api_fleet", () => {
    const store = synced();
    expect(store.get().fleets.map((f) => f.id)).toEqual([1, 2, 3, 4]);
    expect(store.get().ships.map((s) => s.fleet_id)).toEqual([1, 2, 3, 4]);
    const selected = poiQueryShips(store, { fleet_ids: [3] });
    expect(selected.data).toMatchObject({ total: 1, items: [{ instance_id: 12 }] });
    expect(store.get().ships.find((s) => s.instance_id === 13)?.dock).toBe(true);
  });

  it("reads actual mission id, combined roles and expedition overview", () => {
    const store = synced();
    expect(store.get().fleets[2].expedition_id).toBe(37);
    expect(store.get().fleets.map((f) => f.combined_role)).toEqual(["main", "escort", null, null]);
    expect(store.get().operations.expeditions).toEqual([{
      id: 3, fleet_id: 3, expedition_master_id: 37, complete_at: new Date(1800000000000).toISOString(),
    }]);
  });

  it("preserves seven-ship order and supports the legacy deck alias", () => {
    const raw = poiState();
    raw.info.fleets[0].api_ship = [10, 11, 12, 13, 14, 15, 16];
    const legacy = { ...raw, info: { ...raw.info, fleets: undefined, deck: raw.info.fleets } };
    const fleet = bridge.readFleets(legacy)[0];
    expect(fleet.members.map((m) => m.instance_id)).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(fleet.members.map((m) => m.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("counts expansion-slot equipment as occupied instead of free inventory", () => {
    const store = synced();
    expect(store.get().equipment.find((e) => e.instance_id === 22)?.equipped_on).toBe(10);
    expect(poiQueryEquipment(store, { equipped: false, mode: "instances" }).data)
      .toMatchObject({ total: 1, items: [{ instance_id: 23 }] });
  });
});

describe("current fleet configuration tool", () => {
  it("returns four ordered fleets with exact regular/expansion equipment and aircraft", () => {
    const result = poiGetFleets(synced());
    expect(result.status).toBe("ok");
    const data = result.data as any;
    expect(data.fleets).toHaveLength(4);
    expect(data.coverage).toEqual({ fleets: "complete", ships: "complete", equipment: "complete" });
    const member = data.fleets[0].members[0];
    expect(member.equipment_slots).toMatchObject([
      { slot: 1, instance_id: 20, status: "equipped", aircraft_current: 2, aircraft_capacity: 4,
        equipment: { name: "测试装备", improvement: 6, proficiency: 7 } },
      { slot: 2, instance_id: null, status: "empty" },
      { slot: 3, instance_id: 21, status: "equipped" },
    ]);
    expect(member.expansion_slot).toMatchObject({ instance_id: 22, status: "equipped" });
    expect(data.fleets[1].members[0].expansion_slot.status).toBe("empty");
    expect(data.fleets[2].members[0].expansion_slot.status).toBe("closed");
  });

  it("allows a targeted fleet and a compact summary without equipment", () => {
    const result = poiGetFleets(synced(), { fleet_ids: [2], include_equipment: false });
    expect(result.status).toBe("ok");
    const data = result.data as any;
    expect(data.fleets.map((f: any) => f.id)).toEqual([2]);
    expect(data.fleets[0].members[0].equipment_slots).toBeUndefined();
  });

  it("reports unloaded fleets instead of a successful empty fleet list", () => {
    const raw = poiState();
    raw.info.fleets = [];
    const store = synced(raw);
    expect(store.get().freshness.find((f) => f.domain === "fleets")?.coverage).toBe("not_loaded");
    expect(poiGetFleets(store)).toMatchObject({ status: "not_ready", missing: ["fleets"] });
    expect(poiQueryShips(store, { fleet_ids: [1] })).toMatchObject({ status: "partial", missing: ["fleets"] });
  });

  it("preserves an occupied slot when its equipment instance is missing", () => {
    const raw = poiState();
    delete raw.info.equips[22];
    const result = poiGetFleets(synced(raw), { fleet_ids: [1] });
    expect(result.status).toBe("partial");
    expect(result.missing).toContain("equipment:22");
    expect((result.data as any).fleets[0].members[0].expansion_slot)
      .toEqual({ instance_id: 22, status: "unknown", equipment: null });
  });

  it("reports missing ship, unknown expansion slot, and missing requested fleet", () => {
    const store = synced();
    store.setShips(store.get().ships.filter((s) => s.instance_id !== 10));
    expect(poiGetFleets(store, { fleet_ids: [1] }).missing).toContain("ship:10");
    store.setFleets(store.get().fleets.filter((f) => f.id !== 4));
    expect(poiGetFleets(store, { fleet_ids: [4] })).toMatchObject({ status: "partial", missing: ["fleet:4"] });
  });

  it("distinguishes unobserved expansion slots from observed empty slots", () => {
    const store = synced();
    const ship = store.get().ships[0];
    delete ship.slot_ex;
    delete ship.expansion_slot_open;
    const result = poiGetFleets(store, { fleet_ids: [1] });
    expect(result.status).toBe("partial");
    expect(result.missing).toContain("ship:10:slot_ex");
    expect((result.data as any).fleets[0].members[0].expansion_slot.status).toBe("unknown");
  });

  it("keeps absent normal slots unknown and identifies an unloaded equipment domain", () => {
    const raw = poiState();
    const ship = raw.info.ships[10] as Partial<typeof raw.info.ships[10]>;
    delete ship.api_slot;
    const missingSlots = poiGetFleets(synced(raw), { fleet_ids: [1] });
    expect(missingSlots.status).toBe("partial");
    expect(missingSlots.missing).toContain("ship:10:slots");
    expect((missingSlots.data as any).fleets[0].members[0].equipment_slots).toBeNull();
    const missingEquipment = poiGetFleets(synced({ ...poiState(), info: { ...poiState().info, equips: undefined } }));
    expect(missingEquipment.status).toBe("partial");
    expect(missingEquipment.missing).toContain("equipment");
    expect((missingEquipment.data as any).coverage.equipment).toBe("not_loaded");
  });

  it("exposes fleet selectors and equipment details over the MCP protocol", async () => {
    const server = createPoiMcpServer(synced());
    const client = new Client({ name: "fleet-contract-test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const list = await client.listTools();
      const schema = list.tools.find((t) => t.name === "poi_get_fleets")!.inputSchema;
      expect(schema.properties).toHaveProperty("fleet_ids");
      expect(schema.properties).toHaveProperty("include_equipment");
      const result = await client.callTool({ name: "poi_get_fleets", arguments: { fleet_ids: [1] } });
      expect(result.isError).not.toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      const payload = JSON.parse(content[0].text);
      expect(payload.status).toBe("ok");
      expect(payload.data.fleets).toHaveLength(1);
      expect(payload.data.fleets[0].members[0].expansion_slot.instance_id).toBe(22);
      const invalid = await client.callTool({ name: "poi_get_fleets", arguments: { fleet_ids: [5] } });
      expect(invalid.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
