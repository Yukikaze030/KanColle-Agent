/**
 * Fetch official KanColle datasets and build
 * packages/kancolle-data-mcp/data/official/dataset.json
 *
 * Sources:
 * - kcwiki/kancolle-data db/ship.json + db/equipment.json
 * - kcwiki-quest-data (npm)
 * - pinned api_start2 + KC3Kai remodel rules (scripts/remodel-sources.json)
 * - overlay: fixtures for names / equip rules / expeditions / maps
 *
 * Usage: npx tsx scripts/fetch-official-data.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { importRemodelData } from "./remodel-import.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "packages", "kancolle-data-mcp", "data", "official");
const FIXTURE = join(
  ROOT,
  "packages",
  "kancolle-data-mcp",
  "data",
  "fixtures",
  "kancolle.json",
);

const SOURCES = {
  ship: "https://raw.githubusercontent.com/kcwiki/kancolle-data/master/db/ship.json",
  equipment: "https://raw.githubusercontent.com/kcwiki/kancolle-data/master/db/equipment.json",
};

import { fetchJson } from "./fetch-json.mjs";

function readLocalJson(name) {
  const p = join(OUT_DIR, name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function loadOfficialRaw() {
  const rawShips = readLocalJson("ship.json");
  const rawEquips = readLocalJson("equipment.json");
  if (!process.argv.includes("--refresh") && rawShips && rawEquips) {
    console.log("using cached official ship.json / equipment.json");
    return [rawShips, rawEquips];
  }
  console.log("fetching official ship/equipment from GitHub…");
  return Promise.all([fetchJson(SOURCES.ship), fetchJson(SOURCES.equipment)]);
}

function loadQuests() {
  const dir = join(ROOT, "node_modules", "kcwiki-quest-data", "data");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function categoryOf(name = "") {
  if (/艦上戦上戦闘機|戦闘機/.test(name)) return "fighter";
  if (/艦上攻撃機/.test(name)) return "attacker";
  if (/艦上爆撃機|爆撃機/.test(name)) return "bomber";
  if (/陸上攻撃機/.test(name)) return "land_based_attack_aircraft";
  if (/水上偵察機|偵察機/.test(name)) return "recon";
  if (/聴音器|ソナー/.test(name)) return "sonar";
  if (/爆雷/.test(name)) return "depth_charge";
  if (/甲標的/.test(name)) return "midget_submarine";
  if (/対空機銃|機銃/.test(name)) return "anti_air_gun";
  if (/高角砲/.test(name)) return "main_gun";
  if (/副砲/.test(name)) return "secondary_gun";
  if (/魚雷/.test(name)) return "torpedo";
  if (/探照灯/.test(name)) return "searchlight";
  if (/電探|レーダー/.test(name)) return "radar";
  if (/大口径主砲|主砲/.test(name)) return "main_gun";
  return undefined;
}

function categoryFromType(typeId, name = "") {
  const known = {
    1: "small_main_gun", 2: "medium_main_gun", 3: "large_main_gun",
    4: "secondary_gun", 5: "torpedo", 6: "fighter", 7: "bomber",
    8: "attacker", 9: "carrier_recon", 10: "recon", 11: "seaplane_bomber",
    12: "small_radar", 13: "large_radar", 14: "sonar", 15: "depth_charge",
    17: "engine", 20: "anti_air_gun", 22: "midget_submarine",
    24: "landing_craft", 25: "autogyro", 26: "asw_patrol_aircraft",
    31: "aviation_personnel", 32: "depth_charge_projector", 40: "large_sonar",
    43: "combat_ration", 45: "seaplane_fighter", 46: "special_submarine_equipment",
    49: "land_based_recon", 50: "night_recon",
  };
  return known[typeId] ?? categoryOf(name) ?? `equip_type_${typeId}`;
}

const numericKeys = value => Object.keys(value ?? {}).map(Number).filter(Number.isSafeInteger);

function buildMasterEquipRules(remodel) {
  return {
    source: "api_start2",
    normal_by_stype: Object.fromEntries(remodel.stypes.map(s => [
      String(s.api_id),
      Object.entries(s.api_equip_type ?? {}).filter(([, allowed]) => allowed === 1).map(([id]) => Number(id)),
    ])),
    normal_by_ship: Object.fromEntries(Object.entries(remodel.equip_ship ?? {}).map(([shipId, row]) => [
      shipId, numericKeys(row.api_equip_type),
    ])),
    reinforcement_default_types: [...(remodel.equip_exslot ?? [])],
    reinforcement_by_equipment: Object.fromEntries(Object.entries(remodel.equip_exslot_ship ?? {}).map(([equipmentId, row]) => [
      equipmentId,
      {
        ship_ids: numericKeys(row.api_ship_ids),
        stype_ids: numericKeys(row.api_stypes),
        ctype_ids: numericKeys(row.api_ctypes),
        required_level: Number(row.api_req_level ?? 0),
      },
    ])),
    reinforcement_denied_by_ship: Object.fromEntries(Object.entries(remodel.equip_limit_exslot ?? {}).map(([shipId, typeIds]) => [
      shipId, Array.isArray(typeIds) ? typeIds.map(Number) : [],
    ])),
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const [rawShips, rawEquips] = await loadOfficialRaw();
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const quests = loadQuests();
  console.log(
    `official ships=${rawShips.length} equips=${rawEquips.length} quests=${quests.length}`,
  );

  // Match overlay by NAME — fixture IDs are not always official master IDs.
  const fixtureShipByName = new Map(fixture.ships.map((s) => [s.name, s]));
  const remodel = await importRemodelData(ROOT, OUT_DIR, { refresh: process.argv.includes("--refresh") });
  const rawById = new Map(rawShips.map(s => [s.id, s]));
  const typeNames = new Map(remodel.stypes.map(s => [s.api_id, s.api_name]));
  const incoming = new Map();
  for (const edge of remodel.transitions) {
    const id = Number(edge.to.split(":")[1]);
    incoming.set(id, [...(incoming.get(id) ?? []), edge]);
  }

  const ships = remodel.ships.map(m => {
    const s = rawById.get(m.api_id) ?? {};
    const fx = fixtureShipByName.get(m.api_name);
    const predecessors = incoming.get(m.api_id) ?? [];
    const levels = predecessors.map(e => e.level).filter(n => n !== null);
    return {
      id: m.api_id, name: m.api_name, yomi: m.api_yomi,
      stype: fx?.stype ?? typeNames.get(m.api_stype), stype_id: m.api_stype, ctype_id: m.api_ctype,
      remodel_level: levels.length ? Math.min(...levels) : predecessors.length ? null : 0,
      remodel_from: predecessors.length === 1 ? Number(predecessors[0].from.split(":")[1]) : null,
      remodel_to: Number(m.api_aftershipid) || null,
      stats: {
        hp: m.api_taik?.[0], firepower: m.api_houg?.[0], torpedo: m.api_raig?.[0],
        aa: m.api_tyku?.[0], armor: m.api_souk?.[0], luck: m.api_luck?.[0],
        speed: m.api_soku, range: m.api_leng, slotCount: m.api_slot_num,
        evasion: m.api_kaih?.[0] ?? s.evasion,
        asw: m.api_tais?.[0] ?? s.asw,
        los: m.api_saku?.[0] ?? s.los,
      },
      slots: (m.api_maxeq ?? []).slice(0, m.api_slot_num).map(count => ({ type: "normal", count })),
      alias: fx?.alias,
    };
  });

  const rawEquipById = new Map(rawEquips.map(e => [e.id, e]));
  const equipment = remodel.equipment.map((e) => {
    const old = rawEquipById.get(e.api_id) ?? {};
    const fx = fixture.equipment.find((x) => x.id === e.api_id);
    const typeId = e.api_type?.[2];
    return {
      id: e.api_id,
      name: e.api_name,
      type: remodel.equip_types.find(t => t.api_id === typeId)?.api_name,
      type_id: typeId,
      category: categoryFromType(typeId, e.api_name),
      rarity: e.api_rare,
      description: old.description,
      stats: {
        firepower: e.api_houg, torpedo: e.api_raig, aa: e.api_tyku,
        armor: e.api_souk, bombing: e.api_baku, asw: e.api_tais,
        los: e.api_saku, range: e.api_leng, evasion: e.api_houk,
      },
      improvable: fx?.improvable,
      alias: fx?.alias,
    };
  });

  const mappedQuests = quests.map((q) => ({
    game_id: q.game_id,
    wiki_id: q.wiki_id,
    name: q.name,
    type: q.category != null ? String(q.category) : undefined,
    label: q.wiki_id,
    prerequisites: q.prerequisite ?? [],
    unlocks: [],
    requirements_summary: q.detail
      ? String(q.detail).replace(/<br\s*\/?>/gi, " ")
      : q.requirements ? JSON.stringify(q.requirements) : null,
    requirements: q.requirements ?? null,
    rewards: {
      fuel: q.reward_fuel,
      ammo: q.reward_ammo,
      steel: q.reward_steel,
      bauxite: q.reward_bauxite,
      other: q.reward_other ?? [],
    },
    alias: q.wiki_id ? [q.wiki_id] : undefined,
  }));

  const unlocksMap = new Map();
  for (const q of mappedQuests) {
    for (const pre of q.prerequisites || []) {
      if (!unlocksMap.has(pre)) unlocksMap.set(pre, []);
      unlocksMap.get(pre).push(q.game_id);
    }
  }
  for (const q of mappedQuests) {
    q.unlocks = unlocksMap.get(q.game_id) ?? [];
  }

  const dataset = {
    meta: {
      name: "kancolle-official-dataset",
      version: "2.1.0-master-complete",
      commit: remodel.sources.master.split("/")[5],
      era: "2",
      era_name: "二期",
      generated_at: new Date().toISOString(),
      sources: { ...SOURCES, ...remodel.sources },
      quest_source: "kcwiki-quest-data",
      notes: [
        "TARGET ERA: KanColle 二期 only (post-2023-05 server migration)",
        "Ships/equipment/equipment rules/expeditions/maps from pinned api_start2",
        "Equipment descriptions and aliases are overlaid from kcwiki/kancolle-data and local fixtures when IDs match",
        "Quests from kcwiki-quest-data npm",
        "Remodel transitions from pinned api_start2; costs supplemented by pinned KC3Kai community rules",
        "Cost coverage describes modeled fields, not independent in-game verification; upstream rules can lag game updates",
        "Legacy remodel_level is minimum incoming edge level; use transitions[].level for a specific conversion",
        "Do not mix 一期 legacy mechanics into answers",
      ],
    },
    ships,
    items: remodel.items,
    remodel_transitions: remodel.transitions,
    equipment,
    quests: mappedQuests,
    expeditions: remodel.missions.map(m => ({
      id: m.api_id, name: m.api_name, area: String(m.api_maparea_id),
      time_minutes: m.api_time, details: String(m.api_details ?? "").replace(/<br\s*\/?>/gi, " "),
      difficulty: m.api_difficulty, fleet_size: m.api_deck_num,
      sample_fleet: m.api_sample_fleet, fuel_cost_ratio: m.api_use_fuel,
      ammo_cost_ratio: m.api_use_bull,
      resource_reward_levels: m.api_win_mat_level,
      reward_items: [m.api_win_item1, m.api_win_item2]
        .filter(x => Array.isArray(x) && x[0] !== 0)
        .map(x => ({ type: x[0], amount: x[1] })),
      alias: m.api_disp_no ? [m.api_disp_no] : undefined,
    })),
    maps: remodel.maps.map(m => ({
      id: `map:${m.api_maparea_id}-${m.api_no}`, area: m.api_maparea_id, map: m.api_no,
      name: m.api_name, operation: m.api_opetext,
      description: String(m.api_infotext ?? "").replace(/<br\s*\/?>/gi, " "), level: m.api_level,
    })),
    equipment_equipable: { master: buildMasterEquipRules(remodel) },
  };

  const out = join(OUT_DIR, "dataset.json");
  writeFileSync(out + ".tmp", JSON.stringify(dataset), "utf8");
  renameSync(out + ".tmp", out);
  console.log(
    `wrote ${out}\n  ships=${ships.length} equips=${equipment.length} quests=${mappedQuests.length}`,
  );
  writeFileSync(join(OUT_DIR, "ship.json"), JSON.stringify(rawShips), "utf8");
  writeFileSync(join(OUT_DIR, "equipment.json"), JSON.stringify(rawEquips), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
