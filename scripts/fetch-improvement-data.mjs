/**
 * Fetch and normalize the daily improvement schedule from WhoCallsTheFleet.
 *
 * Source: http://fleet.diablohu.com/arsenal/
 * Usage: node scripts/fetch-improvement-data.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "http://fleet.diablohu.com/arsenal/";
const OUT = join(ROOT, "packages", "kancolle-data-mcp", "data", "official", "improvements.json");
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function idFromHref(href, kind) {
  const match = String(href ?? "").match(new RegExp(`/${kind}/(\\d+)/`));
  return match ? Number(match[1]) : null;
}

function ownText($, element) {
  const clone = $(element).clone();
  clone.children().remove();
  return clone.text().trim();
}

function integer(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function materialCost($, block, className) {
  const element = $(block).find(`> i.${className}`).first();
  if (!element.length) return null;
  return {
    normal: integer(ownText($, element)),
    guaranteed: integer(element.children("i").first().text()),
  };
}

function consumables($, block) {
  return $(block).find("> .items > .item > a").map((_, anchor) => {
    const amount = integer($(anchor).children("i").first().text()) ?? 1;
    const id = idFromHref($(anchor).attr("href"), "equipments");
    return id ? {
      equipment_id: id,
      source_name: ownText($, anchor),
      amount,
    } : null;
  }).get().filter(Boolean);
}

function parseStage($, block) {
  if ($(block).find("> i.no").length) return null;
  return {
    development_material: materialCost($, block, "dev_mat"),
    improvement_material: materialCost($, block, "imp_mat"),
    consumables: consumables($, block),
  };
}

function parseUnit($, unit, day) {
  const equipmentLinks = $(unit).find("> strong > a[href^='/equipments/']");
  const first = equipmentLinks.first();
  const equipmentId = idFromHref(first.attr("href"), "equipments");
  if (!equipmentId) return null;

  const last = equipmentLinks.last();
  const upgradeId = equipmentLinks.length > 1
    ? idFromHref(last.attr("href"), "equipments")
    : null;
  const assistants = $(unit).find("> font > a[href^='/ships/']").map((_, anchor) => ({
    ship_id: idFromHref($(anchor).attr("href"), "ships"),
    source_name: $(anchor).text().trim(),
  })).get().filter(row => row.ship_id);

  const detailBlocks = $(unit).children("span").first().children("span");
  const resources = {};
  const stages = { low: null, high: null, upgrade: null };
  detailBlocks.each((index, block) => {
    const label = $(block).find("> em").first().text().trim();
    if (index === 0 || label.includes("必要资源")) {
      for (const key of ["fuel", "ammo", "steel", "bauxite"]) {
        resources[key] = integer($(block).find(`> i.${key}`).first().text()) ?? 0;
      }
    } else if (label.includes("+0") || label.includes("～+6") || label.includes("~ +6")) {
      stages.low = parseStage($, block);
    } else if (label.includes("+6") || label.toUpperCase().includes("MAX")) {
      stages.high = parseStage($, block);
    } else if (label.includes("升级") || label.includes("更新")) {
      stages.upgrade = parseStage($, block);
    }
  });

  return {
    equipment_id: equipmentId,
    source_name: first.text().trim(),
    upgrade_to: upgradeId ? {
      equipment_id: upgradeId,
      source_name: last.text().trim(),
    } : null,
    assistant_required: assistants.length > 0,
    assistant_ships: assistants,
    resources,
    stages,
    weekdays: [day],
  };
}

function stableKey(row) {
  return JSON.stringify({
    equipment_id: row.equipment_id,
    upgrade_to: row.upgrade_to?.equipment_id ?? null,
    assistant_ship_ids: row.assistant_ships.map(ship => ship.ship_id),
    resources: row.resources,
    stages: row.stages,
  });
}

const response = await fetch(SOURCE_URL, { headers: { "user-agent": "KanColle-Agent data importer" } });
if (!response.ok) throw new Error(`Improvement source returned HTTP ${response.status}`);
const html = await response.text();
const $ = cheerio.load(html);
const merged = new Map();

for (let day = 0; day < 7; day += 1) {
  $(`.body-weekday .content-${day} .improvement.unit`).each((_, unit) => {
    const row = parseUnit($, unit, day);
    if (!row) return;
    const key = stableKey(row);
    const previous = merged.get(key);
    if (previous) previous.weekdays.push(day);
    else merged.set(key, row);
  });
}

const records = [...merged.values()]
  .map(row => ({ ...row, weekdays: [...new Set(row.weekdays)].sort((a, b) => a - b) }))
  .sort((a, b) => a.equipment_id - b.equipment_id || a.weekdays[0] - b.weekdays[0]);

if (records.length < 100) throw new Error(`Parsed suspiciously few improvement records: ${records.length}`);
for (const row of records) {
  if (row.weekdays.some(day => day < 0 || day > 6)) throw new Error("Invalid weekday");
}

const output = {
  meta: {
    source: SOURCE_URL,
    fetched_at: new Date().toISOString(),
    timezone: "Asia/Tokyo",
    weekday_names: WEEKDAYS,
    notes: [
      "Assistant ships are bound by exact master ship ID and exact remodel form.",
      "Different forms such as 金剛 and 金剛改二 must never be merged.",
    ],
  },
  records,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output)}\n`, "utf8");
console.log(`wrote ${records.length} improvement records to ${OUT}`);
