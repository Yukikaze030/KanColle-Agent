import {
  dataAmbiguous,
  dataError,
  dataNotFound,
  dataOk,
  dataPartial,
  decodeCursor,
  pickFields,
  type DataResult,
  type MasterQuest,
  type MasterShip,
  type SearchHit,
} from "@kancolle-agent/shared";
import { parseRef } from "@kancolle-agent/shared";
import type { LoadedDataset } from "./data-loader.js";
import type { MemoryIndex } from "./index-memory.js";
import { remodelChain, searchAll } from "./index-memory.js";
import { canShipEquip, whoCanEquip } from "./rules/equipment.js";

export interface ToolContext {
  ds: LoadedDataset;
  index: MemoryIndex;
}

function resolveQuest(index: MemoryIndex, input: string): MasterQuest | null {
  const parsed = parseRef(input);
  if (parsed?.type === "quest") {
    return index.questsByGameId.get(Number(parsed.id)) ?? null;
  }
  if (/^\d+$/.test(input)) {
    return index.questsByGameId.get(Number(input)) ?? null;
  }
  const byWiki = index.questsByWikiId.get(input.toLowerCase());
  if (byWiki) return byWiki;
  const byName = index.questsByName.get(input.toLowerCase());
  if (byName && byName.length === 1) return byName[0];
  return null;
}

export function kcSearch(
  ctx: ToolContext,
  args: { query: string; limit?: number; types?: string[] },
): DataResult<SearchHit[]> {
  try {
    let hits = searchAll(ctx.index, args.query, args.limit ?? 5);
    if (args.types?.length) {
      hits = hits.filter((h) => args.types!.includes(h.type));
    }
    if (hits.length === 0) return dataNotFound(["no_match"]);
    const top = hits[0];
    // ambiguous if multiple high-score different entities share top score with different refs
    const topScore = top.score;
    const tied = hits.filter((h) => h.score === topScore);
    if (tied.length > 1 && topScore < 100) {
      const uniqueNames = new Set(tied.map((t) => t.ref));
      if (uniqueNames.size > 1 && topScore >= 60) {
        // still return list — caller may pick; flag ambiguous only when query is bare name matching many
        return dataOk(hits);
      }
    }
    return dataOk(hits);
  } catch (e) {
    return dataError("search_failed", String(e));
  }
}

export function kcGet(
  ctx: ToolContext,
  args: { ref: string; include?: string[] },
): DataResult<unknown> {
  const parsed = parseRef(args.ref);
  if (!parsed) return dataError("invalid_ref", `Cannot parse ref: ${args.ref}`);

  try {
    switch (parsed.type) {
      case "ship": {
        const ship = ctx.index.shipsById.get(Number(parsed.id));
        if (!ship) return dataNotFound();
        const remodel = remodelChain(ctx.index, ship.id).map((s) => ({
          ref: `ship:${s.id}`,
          name: s.name,
          remodel_level: s.remodel_level ?? null,
        }));
        const base = pickFields(ship as MasterShip & Record<string, unknown>, undefined);
        const include = args.include ?? [];
        const data: Record<string, unknown> = { ...base };
        if (include.includes("remodel") || include.includes("all")) {
          data.remodel_chain = remodel;
        }
        return dataOk(data);
      }
      case "equipment": {
        const eq = ctx.index.equipmentById.get(Number(parsed.id));
        if (!eq) return dataNotFound();
        return dataOk(eq);
      }
      case "quest": {
        const quest = ctx.index.questsByGameId.get(Number(parsed.id));
        if (!quest) return dataNotFound();
        const include = args.include ?? [];
        const data: Record<string, unknown> = { ...quest };
        if (include.includes("graph") || include.includes("all")) {
          data.prerequisites = quest.prerequisites ?? [];
          data.unlocks = quest.unlocks ?? [];
        }
        const missing: string[] = [];
        if (!quest.requirements_summary) missing.push("requirements_summary");
        if (missing.length && quest.name) {
          return dataPartial(data, missing);
        }
        return dataOk(data);
      }
      case "expedition": {
        const x = ctx.index.expeditionsById.get(Number(parsed.id));
        if (!x) return dataNotFound();
        return dataOk(x);
      }
      case "map": {
        const m = ctx.index.mapsById.get(args.ref) ?? ctx.index.mapsById.get(`map:${parsed.id}`);
        if (!m) return dataNotFound();
        return dataOk(m);
      }
      case "item":
      case "enemy":
        return dataNotFound(["entity_type_not_in_v1_dataset"]);
      default:
        return dataError("unsupported_ref_type", parsed.type);
    }
  } catch (e) {
    return dataError("get_failed", String(e));
  }
}

export function kcQuery(
  ctx: ToolContext,
  args: {
    entity: "ship" | "equipment" | "quest" | "expedition" | "map";
    filters?: Record<string, unknown>;
    fields?: string[];
    limit?: number;
    cursor?: string;
  },
): DataResult<Array<Record<string, unknown>>> {
  try {
    let items: Array<Record<string, unknown>> = [];
    const filters = args.filters ?? {};

    if (args.entity === "ship") {
      items = ctx.ds.ships as unknown as Array<Record<string, unknown>>;
      if (typeof filters.stype === "string") {
        items = items.filter((s) => s.stype === filters.stype);
      }
      if (typeof filters.stype_id === "number") {
        items = items.filter((s) => s.stype_id === filters.stype_id);
      }
      if (typeof filters.min_level === "number") {
        items = items.filter((s) => (s.remodel_level as number | null | undefined ?? 0) >= (filters.min_level as number));
      }
    } else if (args.entity === "equipment") {
      items = ctx.ds.equipment as unknown as Array<Record<string, unknown>>;
      if (typeof filters.category === "string") {
        items = items.filter((e) => e.category === filters.category);
      }
      if (typeof filters.min_firepower === "number") {
        items = items.filter((e) => {
          const stats = e.stats as { firepower?: number } | undefined;
          return (stats?.firepower ?? 0) >= (filters.min_firepower as number);
        });
      }
      if (typeof filters.improvable === "boolean") {
        items = items.filter((e) => e.improvable === filters.improvable);
      }
    } else if (args.entity === "quest") {
      items = ctx.ds.quests as unknown as Array<Record<string, unknown>>;
      if (typeof filters.type === "string") {
        items = items.filter((q) => q.type === filters.type);
      }
      if (typeof filters.label === "string") {
        items = items.filter((q) => q.label === filters.label);
      }
    } else if (args.entity === "expedition") {
      items = ctx.ds.expeditions as unknown as Array<Record<string, unknown>>;
      if (typeof filters.area === "string") {
        items = items.filter((x) => x.area === filters.area);
      }
    } else if (args.entity === "map") {
      items = ctx.ds.maps as unknown as Array<Record<string, unknown>>;
      if (typeof filters.area === "number") {
        items = items.filter((m) => m.area === filters.area);
      }
    }

    const { offset, limit } = decodeCursor(args.cursor);
    const effectiveLimit = Math.min(100, Math.max(1, args.limit ?? limit));
    const page = items.slice(offset, offset + effectiveLimit).map((it) =>
      pickFields(it, args.fields),
    );
    const next = offset + page.length < items.length
      ? Buffer.from(JSON.stringify({ offset: offset + page.length, limit: effectiveLimit })).toString("base64url")
      : null;

    return dataOk(page, { cursor: next });
  } catch (e) {
    return dataError("query_failed", String(e));
  }
}

export function kcQuestGraph(
  ctx: ToolContext,
  args: { quest: string; direction?: "up" | "down" | "both"; depth?: number },
): DataResult<{ nodes: Array<{ id: number; name: string; wiki_id?: string }>; edges: Array<{ from: number; to: number; relation: string }> }> {
  const quest = resolveQuest(ctx.index, args.quest);
  if (!quest) {
    // try search
    const hits = searchAll(ctx.index, args.quest, 5).filter((h) => h.type === "quest");
    if (hits.length === 0) return dataNotFound();
    if (hits.length > 1 && hits[0].score < 100) {
      return dataAmbiguous(hits.slice(0, 5));
    }
    return kcQuestGraph(ctx, { ...args, quest: hits[0].ref });
  }

  const direction = args.direction ?? "both";
  const depth = Math.min(5, Math.max(1, args.depth ?? 3));
  const nodes = new Map<number, { id: number; name: string; wiki_id?: string }>();
  const edges: Array<{ from: number; to: number; relation: string }> = [];

  const addNode = (q: MasterQuest) => {
    nodes.set(q.game_id, {
      id: q.game_id,
      name: q.name,
      ...(q.wiki_id ? { wiki_id: q.wiki_id } : {}),
    });
  };

  addNode(quest);

  const walkUp = (id: number, d: number, seen: Set<number>) => {
    if (d <= 0 || seen.has(id)) return;
    seen.add(id);
    for (const pre of ctx.index.questPredecessors.get(id) ?? []) {
      const pq = ctx.index.questsByGameId.get(pre);
      if (!pq) continue;
      addNode(pq);
      edges.push({ from: pre, to: id, relation: "prerequisite" });
      walkUp(pre, d - 1, seen);
    }
  };

  const walkDown = (id: number, d: number, seen: Set<number>) => {
    if (d <= 0 || seen.has(id)) return;
    seen.add(id);
    for (const next of ctx.index.questSuccessors.get(id) ?? []) {
      const nq = ctx.index.questsByGameId.get(next);
      if (!nq) continue;
      addNode(nq);
      edges.push({ from: id, to: next, relation: "unlocks" });
      walkDown(next, d - 1, seen);
    }
  };

  if (direction === "up" || direction === "both") {
    walkUp(quest.game_id, depth, new Set());
  }
  if (direction === "down" || direction === "both") {
    walkDown(quest.game_id, depth, new Set());
  }

  return dataOk({ nodes: [...nodes.values()], edges });
}

export function kcShipRemodel(
  ctx: ToolContext,
  args: { ship: string },
): DataResult<{ ship_ref: string; chain: Array<{ ref: string; name: string; remodel_level: number | null }> }> {
  const hits = searchAll(ctx.index, args.ship, 10).filter((h) => h.type === "ship");
  let ship = ctx.index.shipsById.get(Number(parseRef(args.ship)?.id ?? -1));
  if (!ship && hits.length === 1) {
    ship = ctx.index.shipsById.get(Number(parseRef(hits[0].ref)?.id));
  }
  if (!ship && hits.length > 1) {
    if (hits[0].score >= 100) {
      ship = ctx.index.shipsById.get(Number(parseRef(hits[0].ref)?.id));
    } else {
      return dataAmbiguous(hits);
    }
  }
  if (!ship) return dataNotFound();

  const chain = remodelChain(ctx.index, ship.id).map((s) => ({
    ref: `ship:${s.id}`,
    name: s.name,
    remodel_level: s.remodel_level ?? null,
  }));

  return dataOk({ ship_ref: `ship:${ship.id}`, chain });
}

export function kcEquipmentRules(
  ctx: ToolContext,
  args: {
    ship?: string;
    equipment?: string;
    category?: string;
    mode?: "check" | "who";
    limit?: number;
  },
): DataResult<unknown> {
  const mode = args.mode ?? "check";

  if (mode === "who") {
    const category =
      args.category ??
      (() => {
        if (!args.equipment) return undefined;
        const hits = searchAll(ctx.index, args.equipment, 5).filter((h) => h.type === "equipment");
        if (hits.length === 1) {
          const eq = ctx.index.equipmentById.get(Number(parseRef(hits[0].ref)?.id));
          return eq?.category;
        }
        if (hits.length === 0) return undefined;
        const eq = ctx.index.equipmentById.get(Number(parseRef(hits[0].ref)?.id));
        return eq?.category;
      })();
    if (!category) return dataNotFound(["category_required"]);
    const list = whoCanEquip(ctx.ds, ctx.index, category, args.limit ?? 20);
    return dataOk({ category, ships: list });
  }

  if (!args.ship || !args.equipment) {
    return dataError("invalid_args", "mode=check requires ship and equipment");
  }

  const shipHits = searchAll(ctx.index, args.ship, 5).filter((h) => h.type === "ship");
  let ship = ctx.index.shipsById.get(Number(parseRef(args.ship)?.id ?? -1));
  if (!ship) {
    if (shipHits.length === 0) return dataNotFound(["ship"]);
    if (shipHits.length > 1 && shipHits[0].score < 100) {
      return dataAmbiguous(shipHits);
    }
    ship = ctx.index.shipsById.get(Number(parseRef(shipHits[0].ref)?.id));
  }
  if (!ship) return dataNotFound(["ship"]);

  const eqHits = searchAll(ctx.index, args.equipment, 5).filter((h) => h.type === "equipment");
  let eq = ctx.index.equipmentById.get(Number(parseRef(args.equipment)?.id ?? -1));
  if (!eq) {
    if (eqHits.length === 0) return dataNotFound(["equipment"]);
    if (eqHits.length > 1 && eqHits[0].score < 100) return dataAmbiguous(eqHits);
    eq = ctx.index.equipmentById.get(Number(parseRef(eqHits[0].ref)?.id));
  }
  if (!eq) return dataNotFound(["equipment"]);

  const result = canShipEquip(ctx.ds, ship, eq.category, ship.stype_id);
  return dataOk({
    ...result,
    equipment_ref: `equipment:${eq.id}`,
    equipment_name: eq.name,
  });
}

export function kcDataStatus(ctx: ToolContext): DataResult<LoadedDataset> {
  const { ds } = ctx;
  return dataOk({
    name: ds.name,
    version: ds.version,
    commit: ds.commit,
    loaded_at: ds.loaded_at,
    source: ds.source,
    counts: ds.counts,
    capabilities: ds.capabilities,
    ships: [],
    equipment: [],
    quests: [],
    expeditions: [],
    maps: [],
    equipableByCategory: ds.equipableByCategory,
  });
}
