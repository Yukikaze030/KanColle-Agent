import type { Coverage, DomainFreshness, SnapshotMeta } from "./result.js";
import type { MasterRef } from "./refs.js";

export type DamageState = "healthy" | "shouha" | "chuha" | "heavily_damaged" | "taiha" | "unknown";
export type QuestState = "active" | "observed_completed" | "unknown" | "available";
export type ShipStype = string;
export type EquipCategory = string;

export interface ShipStats {
  hp?: number;
  firepower?: number;
  torpedo?: number;
  aa?: number;
  armor?: number;
  luck?: number;
  evasion?: number;
  asw?: number;
  los?: number;
  range?: number;
  speed?: number;
  slotCount?: number;
}

export interface ShipRecord {
  instance_id: number;
  master_id: number;
  master_ref: MasterRef;
  name: string;
  level: number;
  exp: number;
  hp: number;
  max_hp: number;
  condition: number;
  locked: boolean;
  damage: DamageState;
  stype?: ShipStype;
  fleet_id?: number | null;
  dock?: boolean;
  slot_items?: Array<number | null>;
  stats?: ShipStats;
}

export interface EquipmentRecord {
  instance_id: number;
  master_id: number;
  master_ref: MasterRef;
  name: string;
  improvement: number;
  proficiency: number;
  locked: boolean;
  equipped_on: number | null;
  category?: EquipCategory;
  stats?: ShipStats;
}

export interface FleetMember {
  instance_id: number;
  master_id: number;
  name: string;
  level: number;
  damage: DamageState;
}

export interface FleetRecord {
  id: number;
  name: string;
  members: FleetMember[];
  expedition_id?: number | null;
  mission_complete_at?: string | null;
  is_combined?: boolean;
  combined_role?: "main" | "escort" | null;
}

export interface QuestRecord {
  game_id: number;
  wiki_id?: string;
  name: string;
  type?: string;
  state: QuestState;
  progress?: number | null;
  observed_at?: string | null;
  source?: "local_observed" | "api" | "unknown";
}

export interface MaterialCounts {
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
  bucket: number;
  instant_construction: number;
  development_material: number;
  improvement_material: number;
}

export interface UseItemRecord {
  master_id: number;
  name: string;
  count: number;
}

export interface InventorySnapshot {
  materials: MaterialCounts | null;
  materials_coverage: Coverage;
  useitems: UseItemRecord[] | null;
  useitems_coverage: Coverage;
}

export interface RepairDock {
  id: number;
  ship_instance_id: number | null;
  complete_at: string | null;
  bucket_used: boolean;
}

export interface ConstructionDock {
  id: number;
  complete_at: string | null;
  is_open: boolean;
}

export interface ExpeditionSlot {
  id: number;
  fleet_id: number;
  expedition_master_id: number;
  complete_at: string | null;
}

export interface SortieState {
  active: boolean;
  map_ref: string | null;
  fleet_ids: number[];
  node?: string | null;
}

export interface LastBattle {
  result: "S" | "A" | "B" | "C" | "D" | "E" | null;
  map_ref: string | null;
  boss: boolean;
  occurred_at: string | null;
}

export interface PlayerProfile {
  name: string;
  level: number;
  rank?: string;
  ship_slots?: number;
  equipment_slots?: number;
}

export interface PlayerResources extends MaterialCounts {
  max_fuel?: number;
  max_ammo?: number;
  max_steel?: number;
  max_bauxite?: number;
}

export interface PlayerSnapshot {
  version: number;
  generated_at: string;
  profile: PlayerProfile | null;
  resources: PlayerResources | null;
  ships: ShipRecord[];
  equipment: EquipmentRecord[];
  fleets: FleetRecord[];
  quests: QuestRecord[];
  maps: Array<{ area: number; map: number; cleared: boolean }>;
  inventory: InventorySnapshot;
  repairs: RepairDock[];
  constructions: ConstructionDock[];
  operations: {
    expeditions: ExpeditionSlot[];
    sortie: SortieState;
    last_battle: LastBattle | null;
  };
  freshness: DomainFreshness[];
  online: boolean;
  player_logged_in: boolean;
}

export function emptySnapshot(): PlayerSnapshot {
  const now = new Date().toISOString();
  return {
    version: 0,
    generated_at: now,
    profile: null,
    resources: null,
    ships: [],
    equipment: [],
    fleets: [],
    quests: [],
    maps: [],
    inventory: {
      materials: null,
      materials_coverage: "not_loaded",
      useitems: null,
      useitems_coverage: "not_loaded",
    },
    repairs: [],
    constructions: [],
    operations: {
      expeditions: [],
      sortie: { active: false, map_ref: null, fleet_ids: [], node: null },
      last_battle: null,
    },
    freshness: [],
    online: false,
    player_logged_in: false,
  };
}

export function snapshotMeta(snap: PlayerSnapshot): SnapshotMeta {
  return { version: snap.version, generated_at: snap.generated_at };
}

export function damageFromHp(hp: number, maxHp: number): DamageState {
  if (maxHp <= 0) return "unknown";
  const ratio = hp / maxHp;
  if (ratio > 0.75) return "healthy";
  if (ratio > 0.5) return "shouha";
  if (ratio > 0.25) return "chuha";
  return "taiha";
}

// ---- Static master data shapes (Data MCP) ----

export interface MasterShip {
  id: number;
  wiki_id?: string;
  name: string;
  yomi?: string;
  stype: string;
  stype_id?: number;
  rarity?: number;
  remodel_level?: number | null;
  remodel_to?: number | null;
  remodel_from?: number | null;
  stats?: ShipStats;
  slots?: Array<{ type: string; count?: number }>;
  alias?: string[];
  reading?: string;
}

/** Costs belong to directed transitions, not destination ship forms. */
export interface RemodelTransition {
  from: string;
  to: string;
  level: number | null;
  resources: Record<string, number | null>;
  items: Array<{ ref: string; name: string; count: number | null }>;
  equipment: Array<{ ref: string; name: string; count: number | null }>;
  coverage: "complete" | "partial";
  missing: string[];
  sources: string[];
}

export interface MasterItem {
  id: number;
  name: string;
  alias?: string[];
  description?: string;
}

export interface MasterEquipment {
  id: number;
  wiki_id?: string;
  name: string;
  type?: string;
  type_id?: number;
  category?: string;
  rarity?: number;
  stats?: ShipStats;
  improvable?: boolean;
  alias?: string[];
}

export interface MasterQuest {
  game_id: number;
  wiki_id?: string;
  name: string;
  type?: string;
  label?: string;
  rewards?: {
    fuel?: number;
    ammo?: number;
    steel?: number;
    bauxite?: number;
    item?: string;
    equipment?: MasterRef;
  };
  prerequisites?: number[];
  unlocks?: number[];
  requirements_summary?: string | null;
  alias?: string[];
}

export interface MasterExpedition {
  id: number;
  name: string;
  area?: string;
  time_minutes?: number;
  fuel?: number;
  ammo?: number;
  steel?: number;
  bauxite?: number;
  alias?: string[];
}

export interface MasterMap {
  id: string;
  area: number;
  map: number;
  name?: string;
  alias?: string[];
}

export interface DatasetStatus {
  name: string;
  version: string;
  /** Game era this dataset targets. "2" = 二期 (post-2023-05 server migration). */
  era?: "1" | "2" | string;
  commit?: string;
  loaded_at: string;
  source: string;
  counts: {
    ships: number;
    equipment: number;
    quests: number;
    expeditions: number;
    maps: number;
    items?: number;
    remodel_transitions?: number;
  };
  capabilities: string[];
  provenance?: Record<string, string>;
  warnings?: string[];
}

export interface SearchHit {
  ref: string;
  name: string;
  type: string;
  score: number;
}
