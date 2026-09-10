import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";
import { kcSearch, kcGet, kcDataStatus } from "../src/tools.js";

const officialPath = join(
  process.cwd(),
  "data",
  "official",
  "dataset.json",
);

describe("official dataset", () => {
  it("loads official dataset with full ship/quest coverage", () => {
    if (!existsSync(officialPath)) {
      // skip when not built
      expect(true).toBe(true);
      return;
    }
    process.env.KANCOLLE_DATA_SOURCE = "official";
    const ds = loadDataset();
    expect(ds.name).toContain("official");
    expect(ds.counts.ships).toBeGreaterThan(500);
    expect(ds.counts.equipment).toBeGreaterThan(500);
    expect(ds.counts.quests).toBeGreaterThan(300);

    const ctx = { ds, index: buildIndex(ds) };
    const status = kcDataStatus(ctx);
    expect(status.status).toBe("ok");
    expect((status.data as { counts: { ships: number } }).counts.ships).toBeGreaterThan(500);

    // 矢矧改二乙 official master id is 668
    const search = kcSearch(ctx, { query: "矢矧改二乙" });
    expect(search.status).toBe("ok");
    expect(search.data?.[0]?.ref).toBe("ship:668");

    const get = kcGet(ctx, { ref: "ship:668" });
    expect(get.status).toBe("ok");
    expect((get.data as { name: string }).name).toBe("矢矧改二乙");
    process.env.KANCOLLE_DATA_SOURCE = "fixture";
  });
});
