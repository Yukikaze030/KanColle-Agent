import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildRemodelTransitions, normalizeItems, type ApiRow, type RemodelRules } from "../src/adapters/remodel.js";

const sandbox: { window: { RemodelDb?: RemodelRules } } = { window: {} };
vm.runInNewContext(readFileSync(new URL("../vendor/kc3kai/RemodelDb.js", import.meta.url), "utf8"), sandbox);
const rules = sandbox.window.RemodelDb!;
const ship = (id: number, to: number, ammo = 470, steel = 390): ApiRow => ({
  api_id: id, api_aftershipid: String(to), api_afterlv: 97, api_afterbull: ammo, api_afterfuel: steel,
});
const upgrade = (from: number, to: number): ApiRow => ({
  api_current_ship_id: from, api_id: to, api_drawing_count: 2, api_report_count: 2,
  api_arms_mat_count: 3, api_aviation_mat_count: 0, api_catapult_count: 0, api_tech_count: 0,
});
const items = normalizeItems([
  { api_id: 58, api_name: "改装設計図" }, { api_id: 78, api_name: "戦闘詳報" },
  { api_id: 75, api_name: "新型砲熕兵装資材" }, { api_id: 77, api_name: "新型航空兵装資材" },
  { api_id: 94, api_name: "新型兵装資材" }, { api_id: 104, api_name: "工廠資源" },
]);
const build = (ships = [ship(145, 961), ship(961, 0)], upgrades: ApiRow[] | undefined = [upgrade(145, 961)]) =>
  buildRemodelTransitions(ships, upgrades, items, [{ api_id: 87, api_name: "新型高温高圧缶" }], rules);

describe("master + pinned KC3 rule adapter", () => {
  it("keeps arms material distinct and translates afterfuel to steel", () => {
    const [edge] = build();
    expect(edge).toMatchObject({ from: "ship:145", to: "ship:961", level: 97, coverage: "complete" });
    expect(edge.resources).toEqual({ ammo: 470, steel: 390, development_material: 77, instant_construction: 0, improvement_material: 0 });
    expect(edge.items).toEqual([
      { ref: "item:58", name: "改装設計図", count: 2 },
      { ref: "item:78", name: "戦闘詳報", count: 2 },
      { ref: "item:94", name: "新型兵装資材", count: 3 },
    ]);
  });
  it("does not silently replace missing master fields with zero", () => {
    const u = upgrade(145, 961); delete u.api_arms_mat_count;
    const [edge] = build(undefined, [u]);
    expect(edge.coverage).toBe("partial");
    expect(edge.items.find(i => i.ref === "item:94")?.count).toBeNull();
    expect(edge.missing).toContain("item:94.count");
  });
  it("distinguishes no special upgrade row from a missing upgrade table", () => {
    const normal = [ship(1, 2, 100, 100), ship(2, 0)];
    expect(build(normal, [])[0].coverage).toBe("complete");
    const [edge] = buildRemodelTransitions(normal, undefined, items, [], rules);
    expect(edge.coverage).toBe("partial");
    expect(edge.resources.development_material).toBeNull();
  });
  it("marks unavailable community rules as partial", () => {
    const [edge] = buildRemodelTransitions([ship(145, 961), ship(961, 0)], [upgrade(145, 961)], items, [], undefined);
    expect(edge.coverage).toBe("partial");
    expect(edge.resources.instant_construction).toBeNull();
  });
  it("keeps cyclic conversions and each direction's distinct cost", () => {
    const edges = build([ship(501, 506, 100, 200), ship(506, 501, 300, 400)], []);
    expect(edges.map(e => [e.from, e.to, e.resources.instant_construction])).toEqual([
      ["ship:501", "ship:506", 60], ["ship:506", "ship:501", 40],
    ]);
    expect(edges.map(e => e.resources.ammo)).toEqual([100, 300]);
  });
  it("classifies consumed boiler as equipment and artillery material as an item", () => {
    const u = { ...upgrade(136, 911), api_boiler_count: 2 };
    const [edge] = build([ship(136, 911), ship(911, 0)], [u]);
    expect(edge.equipment).toEqual([{ ref: "equipment:87", name: "新型高温高圧缶", count: 2 }]);
    expect(edge.items.find(i => i.ref === "item:75")?.count).toBe(3);
  });
  it("rejects orphan, duplicate, contradictory and invalid transitions", () => {
    expect(() => build([ship(1, 2)], [])).toThrow("Missing remodel target");
    expect(() => build(undefined, [upgrade(145, 961), upgrade(145, 961)])).toThrow("Duplicate");
    expect(() => build(undefined, [upgrade(145, 999)])).toThrow("Conflicting");
    expect(() => build([{ api_id: 1 }], [])).toThrow("Invalid remodel target");
  });
  it("flags newly introduced API cost fields instead of silently dropping them", () => {
    const [edge] = build(undefined, [{ ...upgrade(145, 961), api_future_count: 2 }]);
    expect(edge.coverage).toBe("partial");
    expect(edge.missing).toContain("unmapped:api_future_count");
  });
  it("does not infer an unknown material identity from neighboring names", () => {
    const [edge] = buildRemodelTransitions([ship(145, 961), ship(961, 0)], [upgrade(145, 961)], items.filter(i => i.id !== 94), [], rules);
    expect(edge.items.find(i => i.ref === "item:94")).toEqual({ ref: "item:94", name: "item:94", count: 3 });
    expect(edge.missing).toContain("item:94.identity");
  });
});
