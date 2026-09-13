import type {
  MasterEquipment,
  MasterExpedition,
  MasterMap,
  MasterQuest,
  MasterShip,
  MasterItem,
  RemodelTransition,
  SearchHit,
} from "@kancolle-agent/shared";
import type { LoadedDataset } from "./data-loader.js";

export interface MemoryIndex {
  itemsById: Map<number, MasterItem>;
  remodelTransitions: RemodelTransition[] | null;
  shipsById: Map<number, MasterShip>;
  shipsByName: Map<string, MasterShip[]>;
  equipmentById: Map<number, MasterEquipment>;
  equipmentByName: Map<string, MasterEquipment[]>;
  questsByGameId: Map<number, MasterQuest>;
  questsByWikiId: Map<string, MasterQuest>;
  questsByName: Map<string, MasterQuest[]>;
  expeditionsById: Map<number, MasterExpedition>;
  mapsById: Map<string, MasterMap>;
  questPredecessors: Map<number, number[]>;
  questSuccessors: Map<number, number[]>;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function pushName<T extends { id?: number; game_id?: number; name: string }>(
  map: Map<string, T[]>,
  key: string,
  item: T,
): void {
  const k = normalize(key);
  if (!k) return;
  const list = map.get(k);
  if (list) list.push(item);
  else map.set(k, [item]);
}

export function buildIndex(ds: LoadedDataset): MemoryIndex {
  const shipsById = new Map<number, MasterShip>();
  const shipsByName = new Map<string, MasterShip[]>();
  const equipmentById = new Map<number, MasterEquipment>();
  const equipmentByName = new Map<string, MasterEquipment[]>();
  const questsByGameId = new Map<number, MasterQuest>();
  const questsByWikiId = new Map<string, MasterQuest>();
  const questsByName = new Map<string, MasterQuest[]>();
  const expeditionsById = new Map<number, MasterExpedition>();
  const mapsById = new Map<string, MasterMap>();
  const questPredecessors = new Map<number, number[]>();
  const questSuccessors = new Map<number, number[]>();

  for (const s of ds.ships) {
    shipsById.set(s.id, s);
    pushName(shipsByName, s.name, s);
    if (s.yomi) pushName(shipsByName, s.yomi, s);
    for (const a of s.alias ?? []) pushName(shipsByName, a, s);
  }

  for (const e of ds.equipment) {
    equipmentById.set(e.id, e);
    pushName(equipmentByName, e.name, e);
    for (const a of e.alias ?? []) pushName(equipmentByName, a, e);
  }

  for (const q of ds.quests) {
    questsByGameId.set(q.game_id, q);
    if (q.wiki_id) questsByWikiId.set(normalize(q.wiki_id), q);
    pushName(questsByName, q.name, q);
    for (const a of q.alias ?? []) pushName(questsByName, a, q);

    for (const pre of q.prerequisites ?? []) {
      const succ = questSuccessors.get(pre) ?? [];
      if (!succ.includes(q.game_id)) succ.push(q.game_id);
      questSuccessors.set(pre, succ);
      const pred = questPredecessors.get(q.game_id) ?? [];
      if (!pred.includes(pre)) pred.push(pre);
      questPredecessors.set(q.game_id, pred);
    }
  }

  for (const x of ds.expeditions) {
    expeditionsById.set(x.id, x);
  }

  for (const m of ds.maps) {
    mapsById.set(m.id, m);
  }

  return {
    itemsById: new Map(ds.items.map(item => [item.id, item])),
    remodelTransitions: ds.remodel_transitions,
    shipsById,
    shipsByName,
    equipmentById,
    equipmentByName,
    questsByGameId,
    questsByWikiId,
    questsByName,
    expeditionsById,
    mapsById,
    questPredecessors,
    questSuccessors,
  };
}

export function scoreMatch(query: string, candidates: string[]): number {
  const q = normalize(query);
  if (!q) return 0;
  let best = 0;
  for (const c of candidates) {
    const n = normalize(c);
    if (!n) continue;
    if (n === q) best = Math.max(best, 100);
    else if (n.startsWith(q)) best = Math.max(best, 80);
    else if (n.includes(q)) best = Math.max(best, 60);
    else if (q.includes(n) && n.length >= 2) best = Math.max(best, 50);
    else {
      // token overlap
      const cq = new Set(q.split(""));
      const cc = new Set(n.split(""));
      let inter = 0;
      for (const ch of cq) if (cc.has(ch)) inter++;
      const ratio = inter / Math.max(cq.size, cc.size);
      if (ratio > 0.6) best = Math.max(best, Math.round(ratio * 40));
    }
  }
  return best;
}

export function searchAll(index: MemoryIndex, query: string, limit = 5, types?: string[]): SearchHit[] {
  const hits: SearchHit[] = [];
  const q = query.trim();
  if (!q) return hits;

  for (const s of index.shipsById.values()) {
    const names = [s.name, s.yomi ?? "", ...(s.alias ?? [])];
    const score = Math.max(
      scoreMatch(q, names),
      /^\d+$/.test(q) && s.id === Number(q) ? 95 : 0,
      q.toLowerCase() === `ship:${s.id}` ? 100 : 0,
    );
    if (score >= 40) {
      hits.push({ ref: `ship:${s.id}`, name: s.name, type: "ship", score });
    }
  }

  for (const e of index.equipmentById.values()) {
    const names = [e.name, ...(e.alias ?? [])];
    const score = Math.max(
      scoreMatch(q, names),
      q.toLowerCase() === `equipment:${e.id}` ? 100 : 0,
    );
    if (score >= 40) {
      hits.push({ ref: `equipment:${e.id}`, name: e.name, type: "equipment", score });
    }
  }

  for (const quest of index.questsByGameId.values()) {
    const names = [quest.name, quest.wiki_id ?? "", ...(quest.alias ?? [])];
    const score = Math.max(
      scoreMatch(q, names),
      q.toLowerCase() === `quest:${quest.game_id}` ? 100 : 0,
    );
    if (score >= 40) {
      hits.push({
        ref: `quest:${quest.game_id}`,
        name: quest.name,
        type: "quest",
        score,
      });
    }
  }

  for (const x of index.expeditionsById.values()) {
    const names = [x.name, ...(x.alias ?? [])];
    const score = Math.max(
      scoreMatch(q, names),
      q.toLowerCase() === `expedition:${x.id}` ? 100 : 0,
    );
    if (score >= 40) {
      hits.push({
        ref: `expedition:${x.id}`,
        name: x.name,
        type: "expedition",
        score,
      });
    }
  }

  for (const m of index.mapsById.values()) {
    const names = [m.id, m.name ?? ""];
    const score = Math.max(scoreMatch(q, names), q === m.id ? 100 : 0);
    if (score >= 40) {
      hits.push({ ref: m.id, name: m.name ?? m.id, type: "map", score });
    }
  }

  for (const item of index.itemsById.values()) {
    const score = Math.max(scoreMatch(q, [item.name, ...(item.alias ?? [])]),
      q.toLowerCase() === `item:${item.id}` ? 100 : 0,
      /^\d+$/.test(q) && item.id === Number(q) ? 95 : 0);
    if (score >= 40) hits.push({ ref: `item:${item.id}`, name: item.name, type: "item", score });
  }
  const filtered = types?.length ? hits.filter(h => types.includes(h.type)) : hits;
  filtered.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
  return filtered.slice(0, Math.min(10, Math.max(1, limit)));
}

export function remodelChain(index: MemoryIndex, shipId: number): MasterShip[] {
  const target = index.shipsById.get(shipId);
  if (!target) return [];

  if (index.remodelTransitions !== null) {
    // Undirected component for related forms; transitions retain the actual direction.
    const ids = new Set([shipId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of index.remodelTransitions) {
        const from = Number(edge.from.split(":")[1]), to = Number(edge.to.split(":")[1]);
        if (ids.has(from) || ids.has(to)) {
          for (const id of [from, to]) if (!ids.has(id)) { ids.add(id); changed = true; }
        }
      }
    }
    const edges = index.remodelTransitions.filter(e => ids.has(Number(e.from.split(":")[1])));
    const destinations = new Set(edges.map(e => Number(e.to.split(":")[1])));
    const sorted = [...ids].sort((a, b) => a - b);
    const roots = sorted.filter(id => !destinations.has(id));
    const ordered: MasterShip[] = [], visited = new Set<number>();
    const visit = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      const ship = index.shipsById.get(id);
      if (ship) ordered.push(ship);
      for (const edge of edges.filter(e => e.from === `ship:${id}`)) visit(Number(edge.to.split(":")[1]));
    };
    for (const id of [...roots, ...sorted]) visit(id);
    return ordered;
  }

  // walk to root via remodel_from
  let root = target;
  const upSeen = new Set<number>();
  while (root.remodel_from != null && !upSeen.has(root.id)) {
    upSeen.add(root.id);
    const parent = index.shipsById.get(root.remodel_from);
    if (!parent) break;
    root = parent;
  }

  // collect all descendants of root (including branches like 改二乙)
  const byFrom = new Map<number, MasterShip[]>();
  for (const s of index.shipsById.values()) {
    if (s.remodel_from == null) continue;
    const list = byFrom.get(s.remodel_from) ?? [];
    list.push(s);
    byFrom.set(s.remodel_from, list);
  }

  const collected: MasterShip[] = [];
  const visit = (s: MasterShip, seen: Set<number>) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    collected.push(s);
    for (const child of byFrom.get(s.id) ?? []) visit(child, seen);
  };
  visit(root, new Set());

  // stable order: by remodel_level then id
  collected.sort((a, b) => {
    const la = a.remodel_level ?? 0;
    const lb = b.remodel_level ?? 0;
    if (la !== lb) return la - lb;
    return a.id - b.id;
  });
  return collected;
}
