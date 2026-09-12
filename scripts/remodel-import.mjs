import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { fetchJson } from "./fetch-json.mjs";
import { buildRemodelTransitions, normalizeItems } from "../packages/kancolle-data-mcp/src/adapters/remodel.ts";

export async function importRemodelData(root, outputDir, { refresh = false } = {}) {
  const sources = JSON.parse(readFileSync(join(root, "scripts/remodel-sources.json"), "utf8"));
  const cachePath = join(outputDir, "remodel-master.json");
  let cached = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : null;
  const masterFile = process.env.KANCOLLE_MASTER_FILE;
  if (refresh || masterFile || cached?.source !== sources.master) {
    const raw = masterFile ? JSON.parse(readFileSync(masterFile, "utf8")) : await fetchJson(sources.master);
    const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
    if (hash !== sources.master_sha256) throw new Error("Master data hash mismatch; update the reviewed source pin and hash together");
    const master = raw.api_data ?? raw;
    for (const key of ["api_mst_ship", "api_mst_shipupgrade", "api_mst_useitem", "api_mst_slotitem", "api_mst_stype"]) {
      if (!Array.isArray(master[key]) || !master[key].length) throw new Error(`Missing master table ${key}`);
    }
    const fields = ["api_id", "api_name", "api_yomi", "api_sortno", "api_stype", "api_aftershipid", "api_afterlv", "api_afterfuel", "api_afterbull", "api_taik", "api_souk", "api_houg", "api_raig", "api_tyku", "api_luck", "api_soku", "api_leng", "api_maxeq", "api_slot_num"];
    cached = {
      source: sources.master,
      ships: master.api_mst_ship.filter(s => s.api_id < 1500 && s.api_sortno > 0)
        .map(s => Object.fromEntries(fields.filter(k => k in s).map(k => [k, s[k]]))),
      upgrades: master.api_mst_shipupgrade,
      items: master.api_mst_useitem,
      equipment: master.api_mst_slotitem,
      stypes: master.api_mst_stype.map(s => ({ api_id: s.api_id, api_name: s.api_name })),
    };
  }
  // Run only the pinned, locally reviewed vendor snapshot; never fetched executable code.
  const code = readFileSync(join(root, "packages/kancolle-data-mcp/vendor/kc3kai/RemodelDb.js"), "utf8");
  const digest = createHash("sha256").update(code).digest("hex");
  if (digest !== sources.rules_sha256) throw new Error("KC3 rules hash mismatch; update and review source pin + vendor snapshot together");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { timeout: 1000 });
  const items = normalizeItems(cached.items);
  const transitions = buildRemodelTransitions(cached.ships, cached.upgrades, items, cached.equipment, sandbox.window.RemodelDb);
  // Cache only after validation. The pin in the cache prevents accidental cross-version reuse.
  writeFileSync(cachePath + ".tmp", JSON.stringify(cached));
  renameSync(cachePath + ".tmp", cachePath);
  return { ...cached, items, transitions, sources: { master: sources.master, "kc3-remodel": sources["kc3-remodel"] } };
}
