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
  type MasterEquipment,
  type SearchHit,
  type RemodelTransition,
} from "@kancolle-agent/shared";
import { parseRef } from "@kancolle-agent/shared";
import type { LoadedDataset } from "./data-loader.js";
import type { MemoryIndex } from "./index-memory.js";
import { remodelChain, searchAll } from "./index-memory.js";
import { canShipEquip, whoCanEquip } from "./rules/equipment.js";
import { calculateAirPowerSlot } from "./rules/air-power.js";
import { loadMapGuide } from "./map-guide.js";
import { tokyoWeekday, type ImprovementDataset, type ImprovementRecord } from "./improvement-data.js";

export interface ToolContext {
  ds: LoadedDataset;
  index: MemoryIndex;
  improvements?: ImprovementDataset | null;
}

function exactKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function resolveExactShip(ctx: ToolContext, input: string): MasterShip | null | MasterShip[] {
  const parsed = parseRef(input);
  if (parsed?.type === "ship") return ctx.index.shipsById.get(Number(parsed.id)) ?? null;
  if (/^\d+$/.test(input)) return ctx.index.shipsById.get(Number(input)) ?? null;
  const direct = ctx.index.shipsByName.get(exactKey(input)) ?? [];
  if (direct.length === 1) return direct[0];
  if (direct.length > 1) return direct;
  const hits = searchAll(ctx.index, input, 10, ["ship"]).filter(hit => hit.score === 100);
  const matches = hits.map(hit => ctx.index.shipsById.get(Number(hit.ref.split(":")[1])))
    .filter((ship): ship is MasterShip => Boolean(ship));
  return matches.length === 1 ? matches[0] : matches.length ? matches : null;
}

function resolveExactEquipment(ctx: ToolContext, input: string): MasterEquipment | null | MasterEquipment[] {
  const parsed = parseRef(input);
  if (parsed?.type === "equipment") return ctx.index.equipmentById.get(Number(parsed.id)) ?? null;
  if (/^\d+$/.test(input)) return ctx.index.equipmentById.get(Number(input)) ?? null;
  const direct = ctx.index.equipmentByName.get(exactKey(input)) ?? [];
  if (direct.length === 1) return direct[0];
  if (direct.length > 1) return direct;
  const hits = searchAll(ctx.index, input, 10, ["equipment"]).filter(hit => hit.score === 100);
  const matches = hits.map(hit => ctx.index.equipmentById.get(Number(hit.ref.split(":")[1])))
    .filter((equipment): equipment is MasterEquipment => Boolean(equipment));
  return matches.length === 1 ? matches[0] : matches.length ? matches : null;
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
    const hits = searchAll(ctx.index, args.query, args.limit ?? 5, args.types);
    if (hits.length === 0 && args.types?.includes("item") && !ctx.ds.capabilities.includes("items")) return dataPartial([], ["items_dataset"]);
    if (hits.length === 0) return dataNotFound(["no_match"]);
    // Ranked hit list is always ok; resolution tools (get/remodel/rules) surface ambiguous.
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
          const result = kcShipRemodel(ctx, { ship: args.ref });
          data.remodel = result.data;
          if (result.status === "partial") return dataPartial(data, result.missing ?? ["remodel"]);
        }
        return dataOk(data);
      }
      case "item": {
        if (!ctx.ds.capabilities.includes("items")) return dataPartial(null, ["items_dataset"]);
        const item = ctx.index.itemsById.get(Number(parsed.id));
        return item ? dataOk(item) : dataNotFound();
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
    entity: "ship" | "equipment" | "quest" | "expedition" | "map" | "item";
    filters?: Record<string, unknown>;
    fields?: string[];
    limit?: number;
    cursor?: string;
  },
): DataResult<Array<Record<string, unknown>>> {
  try {
    let items: Array<Record<string, unknown>> = [];
    const filters = args.filters ?? {};

    if (args.entity === "item") {
      if (!ctx.ds.capabilities.includes("items")) return dataPartial([], ["items_dataset"]);
      items = ctx.ds.items as unknown as Array<Record<string, unknown>>;
    } else if (args.entity === "ship") {
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

    if (Array.isArray(filters.ids)) items = items.filter(i => filters.ids instanceof Array && filters.ids.includes(i.id ?? i.game_id));
    if (typeof filters.name === "string") items = items.filter(i => i.name === filters.name);
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
    const hits = searchAll(ctx.index, args.quest, 5, ["quest"]);
    if (hits.length === 0) return dataNotFound();
    const exact = hits.filter(hit => hit.score === 100);
    if (exact.length !== 1) return dataAmbiguous((exact.length ? exact : hits).slice(0, 5));
    return kcQuestGraph(ctx, { ...args, quest: exact[0].ref });
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

export interface QuestProgressResult {
  target: { id: number; name: string; wiki_id?: string };
  nodes: Array<{
    id: number;
    name: string;
    wiki_id?: string;
    status: "available" | "active" | "claimable" | "observed_completed" | "inferred_completed" | "unknown";
    evidence: "poi_current" | "poi_observed" | "ancestor_inference" | "none";
  }>;
  edges: Array<{ from: number; to: number; relation: "prerequisite" }>;
  unresolved_ids: number[];
  inference_note: string;
}

export function kcQuestProgress(
  ctx: ToolContext,
  args: {
    quest: string;
    player_states?: {
      available?: number[];
      active?: number[];
      claimable?: number[];
      observed_completed?: number[];
    };
  },
): DataResult<QuestProgressResult> {
  const quest = resolveQuest(ctx.index, args.quest);
  if (!quest) {
    const hits = searchAll(ctx.index, args.quest, 5, ["quest"]);
    if (!hits.length) return dataNotFound();
    const exact = hits.filter((hit) => hit.score === 100);
    if (exact.length !== 1) return dataAmbiguous((exact.length ? exact : hits).slice(0, 5));
    return kcQuestProgress(ctx, { ...args, quest: exact[0].ref });
  }

  const states = args.player_states ?? {};
  const explicit = new Map<number, "available" | "active" | "claimable" | "observed_completed">();
  for (const state of ["available", "active", "claimable", "observed_completed"] as const) {
    for (const id of states[state] ?? []) explicit.set(id, state);
  }

  const inferredCompleted = new Set<number>();
  const inferAncestors = (id: number, seen: Set<number>) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const pre of ctx.index.questPredecessors.get(id) ?? []) {
      inferredCompleted.add(pre);
      inferAncestors(pre, seen);
    }
  };
  for (const id of explicit.keys()) inferAncestors(id, new Set());

  const chainIds = new Set<number>([quest.game_id]);
  const edges: QuestProgressResult["edges"] = [];
  const collectTargetAncestors = (id: number, seen: Set<number>) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const pre of ctx.index.questPredecessors.get(id) ?? []) {
      chainIds.add(pre);
      edges.push({ from: pre, to: id, relation: "prerequisite" });
      collectTargetAncestors(pre, seen);
    }
  };
  collectTargetAncestors(quest.game_id, new Set());

  const nodes = [...chainIds]
    .map((id) => ctx.index.questsByGameId.get(id))
    .filter((q): q is MasterQuest => Boolean(q))
    .map((q) => {
      const state = explicit.get(q.game_id);
      if (state) {
        return {
          id: q.game_id,
          name: q.name,
          ...(q.wiki_id ? { wiki_id: q.wiki_id } : {}),
          status: state,
          evidence: state === "observed_completed" ? "poi_observed" : "poi_current",
        } as QuestProgressResult["nodes"][number];
      }
      if (inferredCompleted.has(q.game_id)) {
        return {
          id: q.game_id,
          name: q.name,
          ...(q.wiki_id ? { wiki_id: q.wiki_id } : {}),
          status: "inferred_completed",
          evidence: "ancestor_inference",
        } as QuestProgressResult["nodes"][number];
      }
      return {
        id: q.game_id,
        name: q.name,
        ...(q.wiki_id ? { wiki_id: q.wiki_id } : {}),
        status: "unknown",
        evidence: "none",
      } as QuestProgressResult["nodes"][number];
    });

  return dataOk({
    target: {
      id: quest.game_id,
      name: quest.name,
      ...(quest.wiki_id ? { wiki_id: quest.wiki_id } : {}),
    },
    nodes,
    edges,
    unresolved_ids: nodes.filter((node) => node.status === "unknown").map((node) => node.id),
    inference_note:
      "Ancestors of quests currently visible in Poi are inferred completed, matching poi-plugin-quest-2. Missing quests remain unknown; inference is not persisted game history.",
  });
}

export interface RemodelResult {
  ship_ref: string;
  chain: Array<{ ref: string; name: string; remodel_level: number | null }>;
  transitions: RemodelTransition[];
  scope: "next" | "family";
  coverage: "complete" | "partial";
}

export function kcShipRemodel(
  ctx: ToolContext,
  args: { ship: string; scope?: "next" | "family" },
): DataResult<RemodelResult> {
  const parsed = parseRef(args.ship);
  if (args.ship.includes(":") && parsed?.type !== "ship") return dataError("invalid_ref", "Expected ship:<master_id>");
  const hits = searchAll(ctx.index, args.ship, 10, ["ship"]);
  const explicitId = parsed?.type === "ship" ? Number(parsed.id) : /^\d+$/.test(args.ship) ? Number(args.ship) : null;
  let ship = explicitId !== null ? ctx.index.shipsById.get(explicitId) : undefined;
  if (explicitId !== null && !ship) return dataNotFound();
  if (!ship) {
    const exact = hits.filter(h => h.score === 100);
    if (exact.length === 1) ship = ctx.index.shipsById.get(Number(parseRef(exact[0].ref)?.id));
    else if (hits.length) return dataAmbiguous(exact.length ? exact : hits);
  }
  if (!ship) return dataNotFound();

  const chain = remodelChain(ctx.index, ship.id).map(s => ({
    ref: `ship:${s.id}`, name: s.name, remodel_level: s.remodel_level ?? null,
  }));
  const refs = new Set(chain.map(s => s.ref));
  const scope = args.scope ?? "next";
  const transitions = (ctx.ds.remodel_transitions ?? []).filter(e =>
    scope === "next" ? e.from === `ship:${ship.id}` : refs.has(e.from) || refs.has(e.to));
  const missing = ctx.ds.remodel_transitions === null ? ["remodel_transitions"] : [];
  for (const edge of transitions) {
    for (const field of edge.missing) missing.push(`${edge.from}->${edge.to}:${field}`);
  }
  const data: RemodelResult = {
    ship_ref: `ship:${ship.id}`, chain, transitions,
    scope,
    coverage: missing.length ? "partial" : "complete",
  };
  return missing.length ? dataPartial(data, missing) : dataOk(data);
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
    if (!args.equipment) {
      return dataPartial({ category: args.category ?? null, ships: [] }, ["equipment_required_for_exact_rules"]);
    }
    const parsed = parseRef(args.equipment);
    let eq = parsed?.type === "equipment"
      ? ctx.index.equipmentById.get(Number(parsed.id)) : undefined;
    if (!eq) {
      const hits = searchAll(ctx.index, args.equipment, 10, ["equipment"]);
      if (!hits.length) return dataNotFound(["equipment"]);
      const exact = hits.filter(hit => hit.score === 100);
      if (exact.length !== 1) return dataAmbiguous(exact.length ? exact : hits);
      eq = ctx.index.equipmentById.get(Number(parseRef(exact[0].ref)?.id));
    }
    if (!eq) return dataNotFound(["equipment"]);
    const list = whoCanEquip(ctx.ds, ctx.index, eq, args.limit ?? 20);
    return dataOk({ equipment_ref: `equipment:${eq.id}`, equipment_name: eq.name, category: eq.category, ships: list });
  }

  if (!args.ship || !args.equipment) {
    return dataError("invalid_args", "mode=check requires ship and equipment");
  }

  const shipHits = searchAll(ctx.index, args.ship, 10, ["ship"]);
  let ship = ctx.index.shipsById.get(Number(parseRef(args.ship)?.id ?? -1));
  if (!ship) {
    if (shipHits.length === 0) return dataNotFound(["ship"]);
    const exact = shipHits.filter(hit => hit.score === 100);
    if (exact.length !== 1) return dataAmbiguous(exact.length ? exact : shipHits);
    ship = ctx.index.shipsById.get(Number(parseRef(exact[0].ref)?.id));
  }
  if (!ship) return dataNotFound(["ship"]);

  const eqHits = searchAll(ctx.index, args.equipment, 10, ["equipment"]);
  let eq = ctx.index.equipmentById.get(Number(parseRef(args.equipment)?.id ?? -1));
  if (!eq) {
    if (eqHits.length === 0) return dataNotFound(["equipment"]);
    const exact = eqHits.filter(hit => hit.score === 100);
    if (exact.length !== 1) return dataAmbiguous(exact.length ? exact : eqHits);
    eq = ctx.index.equipmentById.get(Number(parseRef(exact[0].ref)?.id));
  }
  if (!eq) return dataNotFound(["equipment"]);

  const result = canShipEquip(ctx.ds, ship, eq);
  return result.coverage === "partial"
    ? dataPartial(result, [`equipment_rule:${eq.type_id ?? eq.category ?? "unknown"}`])
    : dataOk(result);
}

export function kcAirPower(
  ctx: ToolContext,
  args: {
    slots: Array<{
      equipment: string;
      planes: number;
      improvement?: number;
      proficiency?: number;
      internal_proficiency?: number;
    }>;
    target_air_power?: number;
  },
): DataResult<unknown> {
  const resolved: Array<{ equipment: MasterEquipment; planes: number; improvement: number; proficiency: number; internalProficiency?: number }> = [];
  for (const slot of args.slots) {
    const parsed = parseRef(slot.equipment);
    let equipment = parsed?.type === "equipment"
      ? ctx.index.equipmentById.get(Number(parsed.id)) : undefined;
    if (!equipment) {
      const hits = searchAll(ctx.index, slot.equipment, 10, ["equipment"]);
      if (!hits.length) return dataNotFound([`equipment:${slot.equipment}`]);
      const exact = hits.filter(hit => hit.score === 100);
      if (exact.length !== 1) return dataAmbiguous(exact.length ? exact : hits);
      equipment = ctx.index.equipmentById.get(Number(parseRef(exact[0].ref)?.id));
    }
    if (!equipment) return dataNotFound([`equipment:${slot.equipment}`]);
    if (!Number.isSafeInteger(slot.planes) || slot.planes < 0
      || !Number.isSafeInteger(slot.improvement ?? 0) || (slot.improvement ?? 0) < 0 || (slot.improvement ?? 0) > 10
      || !Number.isSafeInteger(slot.proficiency ?? 0) || (slot.proficiency ?? 0) < 0 || (slot.proficiency ?? 0) > 7
      || (slot.internal_proficiency !== undefined && (!Number.isSafeInteger(slot.internal_proficiency)
        || slot.internal_proficiency < 0 || slot.internal_proficiency > 120))) {
      return dataError("invalid_args", "planes>=0, improvement=0..10, proficiency=0..7, internal_proficiency=0..120");
    }
    resolved.push({ equipment, planes: slot.planes, improvement: slot.improvement ?? 0,
      proficiency: slot.proficiency ?? 0,
      ...(slot.internal_proficiency !== undefined ? { internalProficiency: slot.internal_proficiency } : {}) });
  }
  const slots = resolved.map(calculateAirPowerSlot);
  const airPowerMin = slots.reduce((sum, slot) => sum + slot.air_power_min, 0);
  const airPowerMax = slots.reduce((sum, slot) => sum + slot.air_power_max, 0);
  const target = args.target_air_power;
  return dataOk({
    air_power_min: airPowerMin,
    air_power_max: airPowerMax,
    exact: airPowerMin === airPowerMax,
    target_air_power: target ?? null,
    meets_target: target === undefined ? null : airPowerMin >= target ? true : airPowerMax < target ? false : null,
    slots,
    assumptions: [
      "fleet_air_power_before_losses",
      "displayed proficiency without internal_proficiency returns its internal-value range",
      "land-base interception/defense and route losses are not included",
    ],
  });
}

export function kcMapGuide(
  _ctx: ToolContext,
  args: { map: string; modules?: string[] },
): DataResult<unknown> {
  try {
    const guide = loadMapGuide(args.map, args.modules ?? []);
    const available = new Set(guide.available_modules.map(module => module.key));
    const missing = (args.modules ?? []).filter(key => !available.has(key));
    return missing.length
      ? dataPartial(guide, missing.map(key => `module:${key}`))
      : dataOk(guide);
  } catch (error) {
    const message = error instanceof Error ? error.message : "map_guide_error";
    return message === "map_guide_not_found" ? dataNotFound([`map_guide:${args.map}`]) : dataError("invalid_args", message);
  }
}

export function kcImprovement(
  ctx: ToolContext,
  args: {
    equipment?: string;
    equipment_ids?: number[];
    assistant_ship?: string;
    owned_ship_ids?: number[];
    weekday?: number;
    date?: string;
    all_days?: boolean;
    include_costs?: boolean;
    limit?: number;
  },
): DataResult<unknown> {
  const dataset = ctx.improvements;
  if (!dataset) return dataPartial([], ["improvement_dataset"]);

  let equipmentId: number | undefined;
  if (args.equipment) {
    const resolved = resolveExactEquipment(ctx, args.equipment);
    if (Array.isArray(resolved)) {
      return dataAmbiguous(resolved.map(item => ({
        ref: `equipment:${item.id}`,
        name: item.name,
        type: "equipment",
        score: 100,
      })));
    }
    if (!resolved) return dataNotFound(["equipment"]);
    equipmentId = resolved.id;
  }

  let assistantShipId: number | undefined;
  if (args.assistant_ship) {
    const resolved = resolveExactShip(ctx, args.assistant_ship);
    if (Array.isArray(resolved)) {
      return dataAmbiguous(resolved.map(ship => ({
        ref: `ship:${ship.id}`,
        name: ship.name,
        type: "ship",
        score: 100,
      })));
    }
    if (!resolved) return dataNotFound(["assistant_ship"]);
    assistantShipId = resolved.id;
  }

  let weekday: number | null = null;
  try {
    weekday = args.all_days ? null : (args.weekday ?? tokyoWeekday(args.date));
  } catch (error) {
    return dataError("invalid_date", error instanceof Error ? error.message : String(error));
  }
  if (weekday !== null && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
    return dataError("invalid_weekday", "weekday must be 0 (Sunday) through 6 (Saturday)");
  }

  const equipmentIds = args.equipment_ids?.length ? new Set(args.equipment_ids) : null;
  const ownedShipIds = args.owned_ship_ids?.length ? new Set(args.owned_ship_ids) : null;
  let records = dataset.records.filter(record => {
    if (equipmentId !== undefined && record.equipment_id !== equipmentId) return false;
    if (equipmentIds && !equipmentIds.has(record.equipment_id)) return false;
    if (weekday !== null && !record.weekdays.includes(weekday)) return false;
    if (assistantShipId !== undefined
      && !record.assistant_ships.some(ship => ship.ship_id === assistantShipId)) return false;
    if (ownedShipIds && record.assistant_required
      && !record.assistant_ships.some(ship => ownedShipIds.has(ship.ship_id))) return false;
    return true;
  });

  const total = records.length;
  records = records.slice(0, args.limit ?? 50);
  const includeCosts = args.include_costs ?? true;
  const canonicalEquipment = (id: number, sourceName: string) => {
    const item = ctx.index.equipmentById.get(id);
    return { ref: `equipment:${id}`, name: item?.name ?? sourceName, source_name: sourceName };
  };
  const canonicalShip = (id: number, sourceName: string) => {
    const ship = ctx.index.shipsById.get(id);
    return { ref: `ship:${id}`, name: ship?.name ?? sourceName, source_name: sourceName };
  };
  const stage = (value: ImprovementRecord["stages"]["low"]) => value ? {
    ...value,
    consumables: value.consumables.map(item => ({
      ...canonicalEquipment(item.equipment_id, item.source_name),
      amount: item.amount,
    })),
  } : null;

  const items = records.map(record => {
    const assistants = record.assistant_ships.map(ship => canonicalShip(ship.ship_id, ship.source_name));
    return {
      equipment: canonicalEquipment(record.equipment_id, record.source_name),
      upgrade_to: record.upgrade_to
        ? canonicalEquipment(record.upgrade_to.equipment_id, record.upgrade_to.source_name)
        : null,
      weekdays: record.weekdays,
      weekday_names: record.weekdays.map(day => dataset.meta.weekday_names[day]),
      assistant_required: record.assistant_required,
      assistant_ships: assistants,
      ...(ownedShipIds ? {
        usable_assistant_ships: assistants.filter(ship => ownedShipIds.has(Number(ship.ref.split(":")[1]))),
      } : {}),
      ...(includeCosts ? {
        resources: record.resources,
        stages: {
          low: stage(record.stages.low),
          high: stage(record.stages.high),
          upgrade: stage(record.stages.upgrade),
        },
      } : {}),
    };
  });

  return dataOk({
    total,
    returned: items.length,
    weekday,
    weekday_name: weekday === null ? null : dataset.meta.weekday_names[weekday],
    timezone: dataset.meta.timezone,
    source: dataset.meta.source,
    fetched_at: dataset.meta.fetched_at,
    items,
    notes: [
      "Assistant ships use exact master ship IDs and exact remodel forms; ship families are never collapsed.",
      "weekday uses Tokyo time: 0=Sunday through 6=Saturday.",
    ],
  });
}

export function kcDataStatus(ctx: ToolContext): DataResult<{
  name: string;
  version: string;
  commit?: string;
  loaded_at: string;
  source: string;
  counts: LoadedDataset["counts"];
  capabilities: string[];
  era?: string;
  provenance?: Record<string, string>;
  warnings?: string[];
  improvement?: { source: string; fetched_at: string; records: number; timezone: string } | null;
}> {
  const { ds } = ctx;
  return dataOk({
    name: ds.name,
    version: ds.version,
    commit: ds.commit,
    loaded_at: ds.loaded_at,
    source: ds.source,
    counts: ds.counts,
    capabilities: ds.capabilities,
    era: ds.era,
    provenance: ds.provenance,
    warnings: ds.warnings,
    improvement: ctx.improvements ? {
      source: ctx.improvements.meta.source,
      fetched_at: ctx.improvements.meta.fetched_at,
      records: ctx.improvements.records.length,
      timezone: ctx.improvements.meta.timezone,
    } : null,
  });
}
