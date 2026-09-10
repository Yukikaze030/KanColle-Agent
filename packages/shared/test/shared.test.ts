import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  makeEquipmentRef,
  makeShipRef,
  parseRef,
  pickFields,
  paginate,
  isMasterRef,
  isInstanceRef,
  dataAmbiguous,
  dataNotFound,
} from "../src/index.js";

describe("refs", () => {
  it("parses master refs", () => {
    const p = parseRef("ship:699");
    expect(p).toEqual({ type: "ship", id: "699", raw: "ship:699" });
  });

  it("parses instance refs", () => {
    const p = parseRef("ship_instance:82341");
    expect(p?.type).toBe("ship_instance");
    expect(isInstanceRef("equipment_instance:1")).toBe(true);
    expect(isMasterRef("equipment:169")).toBe(true);
    expect(isMasterRef("ship_instance:1")).toBe(false);
  });

  it("creates refs", () => {
    expect(makeShipRef(699)).toBe("ship:699");
    expect(makeEquipmentRef(169)).toBe("equipment:169");
  });

  it("rejects invalid refs", () => {
    expect(parseRef("nope")).toBeNull();
    expect(parseRef("ship:")).toBeNull();
    expect(parseRef(":1")).toBeNull();
  });
});

describe("cursor", () => {
  it("roundtrips", () => {
    const c = encodeCursor(20, 20);
    expect(decodeCursor(c)).toEqual({ offset: 20, limit: 20 });
  });

  it("paginates", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const first = paginate(items, 20);
    expect(first.page).toHaveLength(20);
    expect(first.total).toBe(45);
    expect(first.cursor).not.toBeNull();
    const second = paginate(items, 20, first.cursor!);
    expect(second.page[0]).toBe(20);
  });
});

describe("pickFields", () => {
  it("projects fields", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pickFields(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
    expect(pickFields(obj)).toBe(obj);
  });
});

describe("result helpers", () => {
  it("not found is not error", () => {
    const r = dataNotFound();
    expect(r.status).toBe("not_found");
    expect(r.data).toBeNull();
    expect(r.error).toBeUndefined();
  });

  it("ambiguous lists candidates without guessing", () => {
    const r = dataAmbiguous([
      { ref: "ship:1", name: "大和", type: "ship" },
      { ref: "ship:136", name: "大和改", type: "ship" },
    ]);
    expect(r.status).toBe("ambiguous");
    expect(r.data).toBeNull();
    expect(r.candidates).toHaveLength(2);
  });
});
