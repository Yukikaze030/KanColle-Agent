import {
  damageFromHp,
  emptySnapshot,
  type Coverage,
  type DamageState,
  type DomainFreshness,
  type PlayerSnapshot,
  type QuestRecord,
  type QuestState,
  type ShipRecord,
  type EquipmentRecord,
  type FleetRecord,
  type InventorySnapshot,
} from "@kancolle-agent/shared";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type DomainName =
  | "profile"
  | "resources"
  | "ships"
  | "equipment"
  | "fleets"
  | "quests"
  | "inventory"
  | "operations";

export class SnapshotStore {
  private snap: PlayerSnapshot = emptySnapshot();
  private listeners: Array<(snap: PlayerSnapshot) => void> = [];

  get(): PlayerSnapshot {
    return this.snap;
  }

  version(): number {
    return this.snap.version;
  }

  onChange(fn: (snap: PlayerSnapshot) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private bump(): void {
    this.snap = {
      ...this.snap,
      version: this.snap.version + 1,
      generated_at: new Date().toISOString(),
    };
    for (const l of this.listeners) l(this.snap);
  }

  private touch(domain: DomainName, coverage?: Coverage): void {
    const now = new Date().toISOString();
    const existing = this.snap.freshness.find((f) => f.domain === domain);
    if (existing) {
      existing.updated_at = now;
      if (coverage) existing.coverage = coverage;
    } else {
      const entry: DomainFreshness = {
        domain,
        updated_at: now,
        ...(coverage ? { coverage } : {}),
      };
      this.snap.freshness.push(entry);
    }
  }

  setOnline(online: boolean, loggedIn: boolean): void {
    this.snap.online = online;
    this.snap.player_logged_in = loggedIn;
    this.bump();
  }

  setProfile(profile: PlayerSnapshot["profile"]): void {
    this.snap.profile = profile;
    this.touch("profile", profile ? "complete" : "not_loaded");
    this.bump();
  }

  setResources(resources: PlayerSnapshot["resources"]): void {
    this.snap.resources = resources;
    this.touch("resources", resources ? "complete" : "not_loaded");
    this.bump();
  }

  setShips(ships: ShipRecord[]): void {
    this.snap.ships = ships;
    this.touch("ships", "complete");
    this.bump();
  }

  setEquipment(equipment: EquipmentRecord[]): void {
    this.snap.equipment = equipment;
    this.touch("equipment", "complete");
    this.bump();
  }

  setFleets(fleets: FleetRecord[]): void {
    this.snap.fleets = fleets;
    this.touch("fleets", "complete");
    this.bump();
  }

  setQuests(quests: QuestRecord[]): void {
    this.snap.quests = quests;
    this.touch("quests", "complete");
    this.bump();
  }

  observeQuestCompleted(gameId: number, name?: string): void {
    const now = new Date().toISOString();
    const existing = this.snap.quests.find((q) => q.game_id === gameId);
    if (existing) {
      existing.state = "observed_completed";
      existing.observed_at = now;
      existing.source = "local_observed";
    } else {
      this.snap.quests.push({
        game_id: gameId,
        name: name ?? `quest:${gameId}`,
        state: "observed_completed",
        observed_at: now,
        source: "local_observed",
      });
    }
    this.touch("quests", "complete");
    this.bump();
  }

  setInventory(inv: Partial<InventorySnapshot>): void {
    this.snap.inventory = { ...this.snap.inventory, ...inv };
    this.touch("inventory", inv.materials ? "complete" : undefined);
    this.bump();
  }

  setRepairs(repairs: PlayerSnapshot["repairs"]): void {
    this.snap.repairs = repairs;
    this.touch("operations", "partial");
    this.bump();
  }

  setConstructions(cons: PlayerSnapshot["constructions"]): void {
    this.snap.constructions = cons;
    this.touch("operations", "partial");
    this.bump();
  }

  setExpeditions(exp: PlayerSnapshot["operations"]["expeditions"]): void {
    this.snap.operations.expeditions = exp;
    this.touch("operations", "partial");
    this.bump();
  }

  setSortie(sortie: PlayerSnapshot["operations"]["sortie"]): void {
    this.snap.operations.sortie = sortie;
    this.touch("operations", "partial");
    this.bump();
  }

  setLastBattle(battle: PlayerSnapshot["operations"]["last_battle"]): void {
    this.snap.operations.last_battle = battle;
    this.touch("operations", "partial");
    this.bump();
  }

  setMaps(maps: PlayerSnapshot["maps"]): void {
    this.snap.maps = maps;
    this.bump();
  }

  /** Replace entire snapshot (used by mock loader / integration). */
  replace(snap: PlayerSnapshot): void {
    this.snap = { ...snap, generated_at: new Date().toISOString() };
    this.bump();
  }

  /** Apply a partial domain patch and bump version. */
  patchDomain(domain: DomainName, patch: Partial<PlayerSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.touch(domain);
    this.bump();
  }
}

export interface RawShipLike {
  api_id: number;
  api_ship_id: number;
  api_lv: number;
  api_exp?: number[];
  api_nowhp?: number;
  api_maxhp?: number;
  api_cond?: number;
  api_locked?: number;
  api_fleet?: number;
  api_slot?: number[];
}

export interface RawEquipLike {
  api_id: number;
  api_slotitem_id: number;
  api_alv?: number;
  api_level?: number;
  api_locked?: number;
}

export interface RawMaterialLike {
  api_id?: number;
  api_value?: number;
}

/** Map KCSAPI / Poi-like ship object into ShipRecord. */
export function normalizeShip(
  raw: RawShipLike,
  masterName?: string,
  stype?: string,
): ShipRecord {
  const maxHp = raw.api_maxhp ?? raw.api_nowhp ?? 1;
  const hp = raw.api_nowhp ?? maxHp;
  const damage: DamageState = damageFromHp(hp, maxHp);
  return {
    instance_id: raw.api_id,
    master_id: raw.api_ship_id,
    master_ref: `ship:${raw.api_ship_id}`,
    name: masterName ?? `ship:${raw.api_ship_id}`,
    level: raw.api_lv,
    exp: raw.api_exp?.[0] ?? 0,
    hp,
    max_hp: maxHp,
    condition: raw.api_cond ?? 49,
    locked: Boolean(raw.api_locked),
    damage,
    ...(stype ? { stype } : {}),
    fleet_id: raw.api_fleet != null && raw.api_fleet >= 0 ? raw.api_fleet + 1 : null,
    slot_items: (raw.api_slot ?? []).map((id) => (id > 0 ? id : null)),
  };
}

export function normalizeEquipment(raw: RawEquipLike, masterName?: string, category?: string): EquipmentRecord {
  return {
    instance_id: raw.api_id,
    master_id: raw.api_slotitem_id,
    master_ref: `equipment:${raw.api_slotitem_id}`,
    name: masterName ?? `equipment:${raw.api_slotitem_id}`,
    improvement: raw.api_level ?? 0,
    proficiency: raw.api_alv ?? 0,
    locked: Boolean(raw.api_locked),
    equipped_on: null,
    ...(category ? { category } : {}),
  };
}

export function defaultFixturePath(): string {
  const candidates = [
    join(process.cwd(), "packages", "poi-plugin-mcp", "fixtures", "mock-player-A.json"),
    join(process.cwd(), "fixtures", "mock-player-A.json"),
    join(process.cwd(), "poi-plugin-kancolle-mcp", "fixtures", "mock-player-A.json"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0];
}

export function loadMockPlayer(path?: string): PlayerSnapshot {
  const p = path ?? defaultFixturePath();
  if (!existsSync(p)) throw new Error(`Mock player fixture not found: ${p}`);
  const raw = JSON.parse(readFileSync(p, "utf8")) as PlayerSnapshot;
  return {
    ...emptySnapshot(),
    ...raw,
    online: true,
    player_logged_in: true,
  };
}

export function aggregateEquipment(
  equipment: EquipmentRecord[],
): Array<{
  master_ref: string;
  name: string;
  count: number;
  improvements: Record<string, number>;
  equipped_count: number;
}> {
  const map = new Map<
    string,
    {
      master_ref: string;
      name: string;
      count: number;
      improvements: Record<string, number>;
      equipped_count: number;
    }
  >();
  for (const e of equipment) {
    const key = e.master_ref;
    const row = map.get(key) ?? {
      master_ref: e.master_ref,
      name: e.name,
      count: 0,
      improvements: {},
      equipped_count: 0,
    };
    row.count += 1;
    const impKey =
      e.improvement >= 10 ? "MAX" : e.improvement > 0 ? `+${e.improvement}` : "+0";
    row.improvements[impKey] = (row.improvements[impKey] ?? 0) + 1;
    if (e.equipped_on != null) row.equipped_count += 1;
    map.set(key, row);
  }
  return [...map.values()];
}

export function questStateFromList(
  quests: QuestRecord[],
  gameId: number,
): QuestState {
  const q = quests.find((x) => x.game_id === gameId);
  if (!q) return "unknown";
  return q.state;
}
