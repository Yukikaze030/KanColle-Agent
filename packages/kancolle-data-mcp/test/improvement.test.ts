import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadDataset } from "../src/data-loader.js";
import { loadImprovementData } from "../src/improvement-data.js";
import { buildIndex } from "../src/index-memory.js";
import { kcImprovement, type ToolContext } from "../src/tools.js";

const ds = loadDataset(fileURLToPath(new URL("../data/official/dataset.json", import.meta.url)));
const improvements = loadImprovementData();
const ctx: ToolContext = { ds, index: buildIndex(ds), improvements };

describe("kc_improvement", () => {
  it("loads the WhoCallsTheFleet schedule", () => {
    expect(improvements?.meta.source).toBe("http://fleet.diablohu.com/arsenal/");
    expect(improvements?.records.length).toBeGreaterThan(500);
  });

  it("keeps 金剛 and 金剛改二 as different assistant ships", () => {
    const kaini = kcImprovement(ctx, {
      equipment: "equipment:88",
      assistant_ship: "ship:149",
      all_days: true,
      include_costs: false,
    });
    expect(kaini.status).toBe("ok");
    expect((kaini.data as { total: number }).total).toBeGreaterThan(0);

    const base = kcImprovement(ctx, {
      equipment: "equipment:88",
      assistant_ship: "ship:78",
      all_days: true,
      include_costs: false,
    });
    expect(base.status).toBe("ok");
    expect((base.data as { total: number }).total).toBe(0);
  });

  it("filters daily results against exact owned ship IDs", () => {
    const result = kcImprovement(ctx, {
      equipment: "equipment:88",
      owned_ship_ids: [78],
      all_days: true,
    });
    expect(result.status).toBe("ok");
    expect((result.data as { total: number }).total).toBe(0);
  });

  it("interprets explicit dates in Tokyo time", () => {
    const result = kcImprovement(ctx, { date: "2026-09-23", limit: 1 });
    expect(result.status).toBe("ok");
    expect((result.data as { weekday: number; weekday_name: string }).weekday).toBe(3);
    expect((result.data as { weekday_name: string }).weekday_name).toBe("wed");
  });
});
