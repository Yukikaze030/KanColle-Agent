import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";
import { kcDataStatus, kcGet, kcQuery, kcSearch, kcShipRemodel } from "../src/tools.js";

const official = new URL("../data/official/dataset.json", import.meta.url);
const context = () => {
  const ds = loadDataset(official.pathname);
  return { ds, index: buildIndex(ds) };
};

describe("remodel and item data contracts", () => {
  it("resolves three separate material IDs and joins the required item to inventory IDs", () => {
    const ctx = context();
    for (const [name, id] of [["新型兵装资材", 94], ["新型航空兵装资材", 77], ["新型火炮兵装资材", 75]] as const) {
      expect(kcSearch(ctx, { query: name, types: ["item"], limit: 1 }).data?.[0]?.ref).toBe(`item:${id}`);
      expect((kcGet(ctx, { ref: `item:${id}` }).data as {id: number}).id).toBe(id);
    }
    const remodel = kcShipRemodel(ctx, { ship: "ship:145" });
    expect(remodel.status).toBe("ok");
    expect(remodel.data?.transitions[0].items.find(i => i.ref === "item:94")?.count).toBe(3);
    const inventory = [{master_id: 75, count: 1}, {master_id: 77, count: 8}, {master_id: 94, count: 0}];
    const required = remodel.data!.transitions[0].items.find(i => i.ref === "item:94")!;
    expect(inventory.find(i => `item:${i.master_id}` === required.ref)?.count).toBe(0);
  });
  it("finds the entire cyclic family from either conversion direction", () => {
    const ctx = context();
    const a = kcShipRemodel(ctx, { ship: "ship:501" });
    const b = kcShipRemodel(ctx, { ship: "ship:506" });
    expect(a.data?.chain).toEqual(b.data?.chain);
    expect(kcShipRemodel(ctx, { ship: "ship:501", scope: "family" }).data?.transitions)
      .toEqual(kcShipRemodel(ctx, { ship: "ship:506", scope: "family" }).data?.transitions);
    expect(a.data?.transitions[0].to).toBe("ship:506");
    expect(b.data?.transitions[0].to).toBe("ship:501");
    expect(a.data?.transitions[0].resources.instant_construction).toBe(60);
    expect(b.data?.transitions[0].resources.instant_construction).toBe(40);
  });
  it("rejects wrong entity refs and ambiguous shared aliases", () => {
    const ctx = context();
    expect(kcShipRemodel(ctx, { ship: "item:145" }).status).toBe("error");
    expect(kcShipRemodel(ctx, { ship: "ship:999999" }).status).toBe("not_found");
    ctx.ds.ships[0].alias = ["shared-name"];
    ctx.ds.ships[1].alias = ["shared-name"];
    ctx.index = buildIndex(ctx.ds);
    expect(kcShipRemodel(ctx, { ship: "shared-name" }).status).toBe("ambiguous");
    expect(kcShipRemodel(ctx, { ship: "145" }).data?.ship_ref).toBe("ship:145");
  });
  it("filters types before truncation and paginates item queries", () => {
    const ctx = context();
    // Lexical tie ordering puts equipment before item. A post-limit filter would lose this item.
    ctx.ds.equipment[0].alias = ["collision"];
    ctx.ds.items[0].alias = ["collision"];
    ctx.index = buildIndex(ctx.ds);
    expect(kcSearch(ctx, { query: "collision", types: ["item"], limit: 1 }).data).toHaveLength(1);
    const first = kcQuery(ctx, { entity: "item", limit: 1, fields: ["id", "name"] });
    const second = kcQuery(ctx, { entity: "item", limit: 1, cursor: first.cursor! });
    expect(first.data?.[0].id).not.toBe(second.data?.[0].id);
    expect(kcQuery(ctx, { entity: "item", filters: { ids: [94] } }).data?.map(i => i.id)).toEqual([94]);
  });
  it("exposes pinned provenance and consistent get(include=remodel)", () => {
    const ctx = context();
    expect(kcDataStatus(ctx).data?.provenance?.master).toMatch(/\/[0-9a-f]{40}\//);
    expect(kcDataStatus(ctx).data?.capabilities).toContain("remodel_costs");
    const detail = kcGet(ctx, { ref: "ship:145", include: ["remodel"] });
    expect((detail.data as {remodel: unknown}).remodel).toEqual(kcShipRemodel(ctx, { ship: "ship:145" }).data);
  });
  it("reports legacy datasets as partial instead of free or no next remodel", () => {
    const ds = loadDataset(new URL("../data/fixtures/kancolle.json", import.meta.url).pathname);
    const ctx = { ds, index: buildIndex(ds) };
    expect(kcShipRemodel(ctx, { ship: String(ds.ships[0].id) }).status).toBe("partial");
    expect(kcGet(ctx, { ref: "item:94" }).missing).toContain("items_dataset");
    expect(kcSearch(ctx, { query: "新型兵装资材", types: ["item"] }).status).toBe("partial");
  });
  it("honors KANCOLLE_DATA_PATH and rejects invalid costs before serving", () => {
    const dir = mkdtempSync(join(tmpdir(), "kc-remodel-"));
    const file = join(dir, "dataset.json");
    const previous = process.env.KANCOLLE_DATA_PATH;
    try {
      const raw = JSON.parse(readFileSync(official, "utf8"));
      raw.meta.name = "explicit-test";
      writeFileSync(file, JSON.stringify(raw));
      process.env.KANCOLLE_DATA_PATH = file;
      expect(loadDataset().name).toBe("explicit-test");
      raw.remodel_transitions[0].items = [{ ref: "equipment:94", name: "bad", count: 1 }];
      writeFileSync(file, JSON.stringify(raw));
      expect(() => loadDataset()).toThrow("Invalid remodel cost ref");
      raw.remodel_transitions[0].items = [];
      raw.remodel_transitions[0].resources.ammo = null;
      writeFileSync(file, JSON.stringify(raw));
      expect(() => loadDataset()).toThrow("Unknown costs marked complete");
    } finally {
      if (previous === undefined) delete process.env.KANCOLLE_DATA_PATH;
      else process.env.KANCOLLE_DATA_PATH = previous;
      rmSync(dir, { recursive: true });
    }
  });
});
