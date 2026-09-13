import { describe, expect, it } from "vitest";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";
import { kcMapGuide } from "../src/tools.js";

const ds = loadDataset();
const ctx = { ds, index: buildIndex(ds) };

describe("kc_map_guide", () => {
  it("returns only the module directory when modules are omitted", () => {
    const result = kcMapGuide(ctx, { map: "5-3" });
    expect(result.status).toBe("ok");
    const data = result.data as { available_modules: Array<{ key: string }>; modules: Record<string, unknown> };
    expect(data.available_modules.map(module => module.key)).toContain("routing");
    expect(data.modules).toEqual({});
  });

  it("returns only requested modules", () => {
    const result = kcMapGuide(ctx, { map: "5-3", modules: ["air-los", "fleets"] });
    expect(result.status).toBe("ok");
    const data = result.data as { modules: Record<string, { title: string; content: string }> };
    expect(Object.keys(data.modules)).toEqual(["air-los", "fleets"]);
    expect(data.modules["air-los"].content).toContain("140");
    expect(data.modules.routing).toBeUndefined();
  });
});
