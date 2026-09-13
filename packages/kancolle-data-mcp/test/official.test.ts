import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";
import { kcSearch, kcGet, kcDataStatus, kcEquipmentRules, kcAirPower } from "../src/tools.js";

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
    expect(ds.era).toBe("2");
    expect(ds.counts.ships).toBeGreaterThan(500);
    expect(ds.counts.equipment).toBe(741);
    expect(ds.counts.quests).toBeGreaterThan(300);
    expect(ds.counts.expeditions).toBe(65);
    expect(ds.counts.maps).toBe(42);

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

    const nightScout = kcEquipmentRules(ctx, {
      ship: "利根改二", equipment: "equipment:102", mode: "check",
    });
    expect(nightScout.status).toBe("ok");
    expect((nightScout.data as { can_equip: boolean; slots: string[]; source: string }).can_equip).toBe(true);
    expect((nightScout.data as { slots: string[] }).slots).toContain("normal");
    expect((nightScout.data as { source: string }).source).toBe("api_start2");

    const yuraNightScout = kcEquipmentRules(ctx, {
      ship: "由良改二", equipment: "equipment:102", mode: "check",
    });
    expect(yuraNightScout.status).toBe("ok");
    expect((yuraNightScout.data as { can_equip: boolean }).can_equip).toBe(true);

    const duplicateEquipment = kcEquipmentRules(ctx, {
      ship: "利根改二", equipment: "5inch単装高射砲", mode: "check",
    });
    expect(duplicateEquipment.status).toBe("ambiguous");

    const firstQuest = kcGet(ctx, { ref: "quest:101" });
    expect(firstQuest.status).toBe("ok");
    expect((firstQuest.data as { requirements: object }).requirements).toBeTruthy();
    expect((firstQuest.data as { rewards: { other: unknown[] } }).rewards.other.length).toBeGreaterThan(0);

    const mapSearch = kcSearch(ctx, { query: "5-3", types: ["map"] });
    expect(mapSearch.status).toBe("ok");
    expect(mapSearch.data?.[0]?.ref).toBe("map:5-3");
    const map = kcGet(ctx, { ref: "map:5-3" });
    expect(map.status).toBe("ok");
    expect((map.data as { name: string }).name).toBe("サブ島沖海域");

    const duplicateShip = kcEquipmentRules(ctx, {
      ship: "宗谷", equipment: "equipment:102", mode: "check",
    });
    expect(duplicateShip.status).toBe("ambiguous");

    const airPower = kcAirPower(ctx, {
      slots: [
        { equipment: "二式水戦改", planes: 7, proficiency: 7 },
        { equipment: "二式水戦改", planes: 11, improvement: 1, proficiency: 7 },
        { equipment: "二式水戦改", planes: 7, proficiency: 7 },
        { equipment: "強風改", planes: 11, proficiency: 7 },
        { equipment: "Ro.44水上戦闘機", planes: 2, proficiency: 7 },
      ],
      target_air_power: 140,
    });
    expect(airPower.status).toBe("ok");
    expect((airPower.data as { air_power_min: number }).air_power_min).toBe(169);
    expect((airPower.data as { air_power_max: number }).air_power_max).toBe(172);
    expect((airPower.data as { meets_target: boolean }).meets_target).toBe(true);
    process.env.KANCOLLE_DATA_SOURCE = "fixture";
  });
});
