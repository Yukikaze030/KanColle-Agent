/**
 * Poi plugin entry (V1 contract).
 *
 * In a real Poi install this module is loaded by Poi's plugin system,
 * reads Redux state, listens for KCSAPI events, and starts the MCP HTTP server.
 * Outside Poi (tests / standalone), use `createPoiRuntime` with an injected store.
 */
import { join } from "node:path";
import { loadOrCreateToken } from "./auth.js";
import { startPoiHttpServer, type RunningHttpServer } from "./http-server.js";
import {
  SnapshotStore,
  loadMockPlayer,
  normalizeEquipment,
  normalizeShip,
} from "./snapshot.js";

export interface PoiRuntime {
  store: SnapshotStore;
  http: RunningHttpServer | null;
  token: string | null;
  start: (opts?: { port?: number; useMock?: boolean }) => Promise<void>;
  stop: () => Promise<void>;
  /** Hook: feed a KCSAPI path + body into the normalizer. */
  handleApiEvent: (path: string, body: unknown) => void;
}

export function createPoiRuntime(tokenPath?: string): PoiRuntime {
  const store = new SnapshotStore();
  let http: RunningHttpServer | null = null;
  let token: string | null = null;

  return {
    store,
    get http() {
      return http;
    },
    get token() {
      return token;
    },
    async start(opts = {}) {
      if (opts.useMock) {
        store.replace(loadMockPlayer());
      }
      const tp = tokenPath ?? join(process.cwd(), "packages", "poi-plugin-mcp", "token.json");
      const file = loadOrCreateToken(tp);
      token = file.token;
      http = await startPoiHttpServer(store, {
        port: opts.port ?? Number(process.env.POI_MCP_PORT ?? 39271),
        token: file.token,
      });
    },
    async stop() {
      if (http) await http.close();
      http = null;
    },
    handleApiEvent(path: string, body: unknown) {
      // Minimal KCSAPI event adapter — enough for V1 tests and real integration points.
      if (path.includes("api_port/port") && body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        const material = b.api_material as Array<{ api_id: number; api_value: number }> | undefined;
        if (material) {
          const val = (id: number) => material.find((m) => m.api_id === id)?.api_value ?? 0;
          store.setResources({
            fuel: val(1),
            ammo: val(2),
            steel: val(3),
            bauxite: val(4),
            bucket: val(5),
            instant_construction: val(6),
            development_material: val(7),
            improvement_material: val(8),
          });
        }
        const shipData = b.api_ship as Array<Parameters<typeof normalizeShip>[0]> | undefined;
        if (shipData) store.setShips(shipData.map((s) => normalizeShip(s)));
        const slotItem = b.api_slot_item as Array<Parameters<typeof normalizeEquipment>[0]> | undefined;
        if (slotItem) store.setEquipment(slotItem.map((e) => normalizeEquipment(e)));
        store.setOnline(true, true);
      } else if (path.includes("api_quest/clearitemget") && body && typeof body === "object") {
        const b = body as { api_quest_id?: number };
        if (b.api_quest_id) store.observeQuestCompleted(b.api_quest_id);
      }
    },
  } as PoiRuntime;
}

export { SnapshotStore, normalizeShip, normalizeEquipment, loadMockPlayer };
export { createPoiMcpServer } from "./mcp-server.js";
export { startPoiHttpServer } from "./http-server.js";
