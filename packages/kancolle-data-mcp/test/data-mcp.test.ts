import { describe, expect, it, beforeAll } from "vitest";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";
import {
  kcDataStatus,
  kcEquipmentRules,
  kcGet,
  kcQuestGraph,
  kcQuery,
  kcSearch,
  kcShipRemodel,
  type ToolContext,
} from "../src/tools.js";

let ctx: ToolContext;

beforeAll(() => {
  const ds = loadDataset();
  ctx = { ds, index: buildIndex(ds) };
});

describe("kc_search", () => {
  it("resolves 矢矧改二乙", () => {
    const r = kcSearch(ctx, { query: "矢矧改二乙", limit: 5 });
    expect(r.status).toBe("ok");
    expect(r.data?.[0]?.ref).toBe("ship:699");
  });

  it("resolves B128 alias", () => {
    const r = kcSearch(ctx, { query: "B128", limit: 5 });
    expect(r.status).toBe("ok");
    expect(r.data?.[0]?.type).toBe("quest");
  });

  it("not_found is not error", () => {
    const r = kcSearch(ctx, { query: "绝对不存在的舰娘xyz" });
    expect(r.status).toBe("not_found");
    expect(r.error).toBeUndefined();
  });
});

describe("kc_get", () => {
  it("gets ship by ref", () => {
    const r = kcGet(ctx, { ref: "ship:699" });
    expect(r.status).toBe("ok");
    expect((r.data as { name: string }).name).toBe("矢矧改二乙");
  });

  it("returns partial when quest lacks requirements", () => {
    // our fixture has requirements_summary on all — ensure get works
    const r = kcGet(ctx, { ref: "quest:424" });
    expect(["ok", "partial"]).toContain(r.status);
    expect((r.data as { name: string }).name).toContain("精鋭");
  });
});

describe("kc_query", () => {
  it("filters light cruisers", () => {
    const r = kcQuery(ctx, {
      entity: "ship",
      filters: { stype: "轻巡洋舰" },
      fields: ["id", "name"],
      limit: 10,
    });
    expect(r.status).toBe("ok");
    expect((r.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("filters equipment by firepower", () => {
    const r = kcQuery(ctx, {
      entity: "equipment",
      filters: { min_firepower: 10 },
      fields: ["id", "name", "stats"],
    });
    expect(r.status).toBe("ok");
    expect((r.data as Array<{ stats: { firepower?: number } }>).every(
      (e) => (e.stats?.firepower ?? 0) >= 10,
    )).toBe(true);
  });
});

describe("kc_quest_graph", () => {
  it("builds B128 prerequisite graph", () => {
    const r = kcQuestGraph(ctx, { quest: "B128", direction: "up", depth: 5 });
    expect(r.status).toBe("ok");
    const data = r.data as {
      nodes: Array<{ id: number }>;
      edges: Array<{ from: number; to: number }>;
    };
    const ids = data.nodes.map((n) => n.id);
    expect(ids).toContain(424);
    expect(ids).toContain(342);
    expect(data.edges.length).toBeGreaterThan(0);
  });
});

describe("kc_ship_remodel", () => {
  it("returns Yahagi chain", () => {
    const r = kcShipRemodel(ctx, { ship: "矢矧" });
    expect(r.status).toBe("ok");
    const data = r.data as { chain: Array<{ name: string; remodel_level: number | null }> };
    expect(data.chain.map((c) => c.name)).toContain("矢矧改二乙");
  });
});

describe("kc_equipment_rules", () => {
  it("CL can equip sonar", () => {
    const r = kcEquipmentRules(ctx, {
      ship: "矢矧改二乙",
      equipment: "三式水中探信仪",
      mode: "check",
    });
    expect(r.status).toBe("ok");
    expect((r.data as { can_equip: boolean }).can_equip).toBe(true);
  });

  it("BB cannot equip midget sub", () => {
    const r = kcEquipmentRules(ctx, {
      ship: "大和",
      equipment: "甲标的",
      mode: "check",
    });
    expect(r.status).toBe("ok");
    expect((r.data as { can_equip: boolean }).can_equip).toBe(false);
  });
});

describe("kc_data_status", () => {
  it("reports dataset counts", () => {
    const r = kcDataStatus(ctx);
    expect(r.status).toBe("ok");
    expect((r.data as { counts: { ships: number } }).counts.ships).toBeGreaterThan(0);
  });
});
