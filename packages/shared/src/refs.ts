/**
 * Canonical entity references shared by Poi MCP and Data MCP.
 * These are the only join keys between services — do not re-resolve names.
 */

export type ShipRef = `ship:${number}`;
export type EquipmentRef = `equipment:${number}`;
export type QuestRef = `quest:${number}`;
export type ExpeditionRef = `expedition:${number}`;
export type EnemyRef = `enemy:${number}`;
export type ItemRef = `item:${number}`;
export type MapRef = `map:${string}`;

export type MasterRef =
  | ShipRef
  | EquipmentRef
  | QuestRef
  | ExpeditionRef
  | EnemyRef
  | ItemRef
  | MapRef;

export type ShipInstanceRef = `ship_instance:${number}`;
export type EquipmentInstanceRef = `equipment_instance:${number}`;
export type InstanceRef = ShipInstanceRef | EquipmentInstanceRef;

export type AnyRef = MasterRef | InstanceRef;

export type MasterRefType =
  | "ship"
  | "equipment"
  | "quest"
  | "expedition"
  | "enemy"
  | "item"
  | "map";

export type InstanceRefType = "ship_instance" | "equipment_instance";

export interface ParsedRef {
  type: MasterRefType | InstanceRefType;
  id: string;
  raw: AnyRef;
}

const MASTER_TYPES: MasterRefType[] = [
  "ship",
  "equipment",
  "quest",
  "expedition",
  "enemy",
  "item",
  "map",
];

const INSTANCE_TYPES: InstanceRefType[] = ["ship_instance", "equipment_instance"];

export function makeShipRef(masterId: number): ShipRef {
  return `ship:${masterId}`;
}

export function makeEquipmentRef(masterId: number): EquipmentRef {
  return `equipment:${masterId}`;
}

export function makeQuestRef(gameId: number): QuestRef {
  return `quest:${gameId}`;
}

export function makeExpeditionRef(id: number): ExpeditionRef {
  return `expedition:${id}`;
}

export function makeShipInstanceRef(instanceId: number): ShipInstanceRef {
  return `ship_instance:${instanceId}`;
}

export function makeEquipmentInstanceRef(instanceId: number): EquipmentInstanceRef {
  return `equipment_instance:${instanceId}`;
}

export function makeMapRef(area: number, map: number): MapRef {
  return `map:${area}-${map}`;
}

export function parseRef(ref: string): ParsedRef | null {
  const idx = ref.indexOf(":");
  if (idx <= 0) return null;
  const type = ref.slice(0, idx);
  const id = ref.slice(idx + 1);
  if (!id) return null;

  if ((MASTER_TYPES as string[]).includes(type) || (INSTANCE_TYPES as string[]).includes(type)) {
    return {
      type: type as MasterRefType | InstanceRefType,
      id,
      raw: ref as AnyRef,
    };
  }
  return null;
}

export function isMasterRef(ref: string): ref is MasterRef {
  const parsed = parseRef(ref);
  return parsed !== null && (MASTER_TYPES as string[]).includes(parsed.type);
}

export function isInstanceRef(ref: string): ref is InstanceRef {
  const parsed = parseRef(ref);
  return parsed !== null && (INSTANCE_TYPES as string[]).includes(parsed.type);
}

export function isShipRef(ref: string): ref is ShipRef {
  return ref.startsWith("ship:");
}

export function isEquipmentRef(ref: string): ref is EquipmentRef {
  return ref.startsWith("equipment:");
}

export function isQuestRef(ref: string): ref is QuestRef {
  return ref.startsWith("quest:");
}

/** Extract numeric master/instance id from a ref. Maps keep the string form. */
export function refNumericId(ref: string): number | null {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  if (parsed.type === "map") return null;
  const n = Number(parsed.id);
  return Number.isFinite(n) ? n : null;
}
