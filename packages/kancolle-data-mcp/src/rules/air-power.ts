import type { MasterEquipment } from "@kancolle-agent/shared";

const AIR_POWER_TYPES = new Set([6, 7, 8, 11, 45, 56, 57, 58, 91]);
const FIGHTER_TYPES = new Set([6, 45]);
const SEAPLANE_BOMBER_TYPES = new Set([11]);
const PROFICIENCY_BAND: Array<[number, number]> = [
  [0, 9], [10, 24], [25, 39], [40, 54], [55, 69], [70, 84], [85, 99], [100, 120],
];
const FIGHTER_ACE_BONUS = [0, 0, 2, 5, 9, 14, 14, 22];
const SEAPLANE_BOMBER_ACE_BONUS = [0, 0, 1, 1, 1, 3, 3, 6];

export interface AirPowerSlotInput {
  equipment: MasterEquipment;
  planes: number;
  improvement: number;
  proficiency: number;
  internalProficiency?: number;
}

export interface AirPowerSlotResult {
  equipment_ref: string;
  equipment_name: string;
  planes: number;
  improvement: number;
  proficiency: number;
  air_power_min: number;
  air_power_max: number;
  exact: boolean;
  warnings: string[];
}

function improvementCoefficient(typeId: number): number | null {
  if (FIGHTER_TYPES.has(typeId)) return 0.2;
  if (typeId === 7) return 0.25;
  return 0;
}

function aceBonus(typeId: number, proficiency: number): number {
  if (FIGHTER_TYPES.has(typeId)) return FIGHTER_ACE_BONUS[proficiency] ?? 0;
  if (SEAPLANE_BOMBER_TYPES.has(typeId)) return SEAPLANE_BOMBER_ACE_BONUS[proficiency] ?? 0;
  return 0;
}

export function calculateAirPowerSlot(input: AirPowerSlotInput): AirPowerSlotResult {
  const { equipment, planes, improvement, proficiency } = input;
  const warnings: string[] = [];
  const typeId = equipment.type_id;
  const aa = equipment.stats?.aa;
  if (typeId === undefined || !AIR_POWER_TYPES.has(typeId) || aa === undefined || planes === 0) {
    if (planes > 0 && typeId !== undefined && !AIR_POWER_TYPES.has(typeId)) warnings.push(`equipment_type_${typeId}_does_not_contribute_to_fleet_air_power`);
    return { equipment_ref: `equipment:${equipment.id}`, equipment_name: equipment.name, planes,
      improvement, proficiency, air_power_min: 0, air_power_max: 0, exact: true, warnings };
  }
  const coefficient = improvementCoefficient(typeId);
  const effectiveAa = aa + (coefficient ?? 0) * improvement;
  if (improvement > 0 && coefficient === 0) warnings.push(`no_verified_improvement_air_power_bonus_for_type:${typeId}`);
  const band = PROFICIENCY_BAND[proficiency] ?? [0, 0];
  const minInternal = input.internalProficiency ?? band[0];
  const maxInternal = input.internalProficiency ?? band[1];
  const fixed = aceBonus(typeId, proficiency);
  const compute = (internal: number) => Math.floor(effectiveAa * Math.sqrt(planes) + fixed + Math.sqrt(internal / 10));
  return {
    equipment_ref: `equipment:${equipment.id}`, equipment_name: equipment.name, planes,
    improvement, proficiency, air_power_min: compute(minInternal), air_power_max: compute(maxInternal),
    exact: input.internalProficiency !== undefined || compute(minInternal) === compute(maxInternal), warnings,
  };
}
