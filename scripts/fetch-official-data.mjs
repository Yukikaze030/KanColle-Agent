/**
 * Fetch official KanColle datasets and build
 * packages/kancolle-data-mcp/data/official/dataset.json
 *
 * Sources:
 * - kcwiki/kancolle-data db/ship.json + db/equipment.json
 * - kcwiki-quest-data (npm)
 * - overlay: fixtures for stype / equip rules / expeditions / maps
 *
 * Usage: node scripts/fetch-official-data.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "kancolle-agent-data-mcp/1.0" },
  });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

function readLocalJson(name) {
  const p = join(OUT_DIR, name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function loadOfficialRaw() {
  const rawShips = readLocalJson("ship.json");
  const rawEquips = readLocalJson("equipment.json");
  if (rawShips && rawEquips) {
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

/** Heuristic remodel chain from Japanese names. */
function buildRemodelHeuristic(ships) {
  const byName = new Map();
  for (const s of ships) {
    if (!s.name) continue;
    const base = s.name
      .replace(/改二[乙丙丁戊己庚辛壬癸]?$/, "")
      .replace(/改$/, "")
      .trim();
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base).push(s);
  }

  const links = new Map();
  const rank = (name) => {
    if (/改二乙|改二丙|改二丁/.test(name)) return 3;
    if (/改二/.test(name)) return 2;
    if (/改$/.test(name)) return 1;
    return 0;
  };
  for (const list of byName.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => {
      const d = rank(a.name) - rank(b.name);
      return d !== 0 ? d : a.id - b.id;
    });
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (rank(next.name) > rank(cur.name)) {
        links.set(cur.id, { ...(links.get(cur.id) || {}), to: next.id });
        links.set(next.id, { ...(links.get(next.id) || {}), from: cur.id });
      }
    }
  }
  return links;
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
  const remodel = buildRemodelHeuristic(rawShips);

  const ships = rawShips.map((s) => {
    const fx = fixtureShipByName.get(s.name);
    const link = remodel.get(s.id) || {};
    return {
      id: s.id,
      name: s.name,
      yomi: fx?.yomi,
      stype: fx?.stype,
      stype_id: fx?.stype_id,
      remodel_level: fx?.remodel_level ?? null,
      remodel_from: link.from ?? null,
      remodel_to: link.to ?? null,
      stats: {
        firepower: s.firepower,
        torpedo: s.torpedo,
        aa: s.aa,
        armor: s.armor,
        evasion: s.evasion,
        asw: s.asw,
        los: s.los,
        range: s.range,
      },
      alias: fx?.alias,
    };
  });

  const equipment = rawEquips.map((e) => {
    const fx = fixture.equipment.find((x) => x.id === e.id);
    return {
      id: e.id,
      name: e.name,
      category: fx?.category ?? categoryOf(e.name),
      stats: {
        firepower: e.firepower,
        torpedo: e.torpedo,
        aa: e.aa,
        armor: e.armor,
        bombing: e.bombing,
        asw: e.asw,
        los: e.los,
        range: e.range,
        evasion: e.evasion,
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
      ? String(q.detail).replace(/<br\s*\/?>/gi, " ").slice(0, 200)
      : q.requirements
        ? JSON.stringify(q.requirements).slice(0, 200)
        : null,
    rewards: {
      fuel: q.reward_fuel,
      ammo: q.reward_ammo,
      steel: q.reward_steel,
      bauxite: q.reward_bauxite,
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
      version: "1.0.0-official",
      generated_at: new Date().toISOString(),
      sources: SOURCES,
      quest_source: "kcwiki-quest-data",
      notes: [
        "Ships/equipment from kcwiki/kancolle-data",
        "Quests from kcwiki-quest-data npm",
        "stype/equip-rules/expeditions/maps overlaid from local fixtures",
        "remodel_to/from partially heuristic from Japanese names",
      ],
    },
    ships,
    equipment,
    quests: mappedQuests,
    expeditions: fixture.expeditions,
    maps: fixture.maps,
    equipment_equipable: fixture.equipment_equipable,
  };

  const out = join(OUT_DIR, "dataset.json");
  writeFileSync(out, JSON.stringify(dataset), "utf8");
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
