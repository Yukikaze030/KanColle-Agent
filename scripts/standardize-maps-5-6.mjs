/**
 * Surgical SCHEMA standardization for maps 5-1..6-5.
 * Preserves existing content; only:
 *  1) renames ## headings to SCHEMA
 *  2) inserts ## 敌方配置 from meta.enemy
 *  3) demotes non-SCHEMA ## to ### under 推荐编成
 *  4) fixes 6-4 带路条件 (drop contaminated dump; keep left/right tables)
 *  5) strips raw NGA dump bullets only when structured tables already exist in same section
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const MAPS_DIR = join(ROOT, ".opencode/skills/fleet-builder/refs/maps");
const META_DIR = join(ROOT, "data/kancolle-maps/meta");
const IDS = ["5-1","5-2","5-3","5-4","5-5","5-6","6-1","6-2","6-3","6-4","6-5"];

const SCHEMA_H2 = [
  "地图信息",
  "带路条件",
  "敌方配置",
  "制空 / 索敌",
  "推荐编成",
  "任务配置",
  "备注",
];
const H2_MAP = {
  地图分析: "地图信息",
  地图简介: "地图信息",
  概要: "地图信息",
  要点: "地图信息",
  地图信息: "地图信息",
  带路条件: "带路条件",
  带路: "带路条件",
  "制空 / 索敌": "制空 / 索敌",
  "制空/索敌": "制空 / 索敌",
  制空: "制空 / 索敌",
  "制空 / 陆航（摘）": "制空 / 索敌",
  推荐编成: "推荐编成",
  常用流派: "推荐编成",
  任务配置: "任务配置",
  相关任务: "任务配置",
  备注: "备注",
};

function compressShips(s) {
  return s
    .replace(/flagship/g, "flag")
    .replace(/elite/g, "elite")
    .replace(/後期型/g, "後")
    .replace(/\(\d+\)/g, "")
    .replace(/、/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEnemy(text) {
  const lines = text.split("\n").map((l) => l.replace(/\r/g, "").trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length && !/敌舰配置|战斗点|航程/.test(lines[i])) i++;
  // advance to first point-like label
  while (i < lines.length && !/^[A-Z](\d|\([^)]+\))?$/.test(lines[i])) i++;
  const rows = [];
  const isPoint = (s) => /^[A-Z](\d|\([^)]+\))?$/.test(s);
  while (i < lines.length) {
    if (!isPoint(lines[i])) { i++; continue; }
    const node = lines[i++];
    const cells = [];
    while (i < lines.length && !isPoint(lines[i])) {
      cells.push(lines[i++]);
      if (cells.length > 8) break;
    }
    let dist = null;
    let ships = "";
    const airs = [];
    const isAir = (s) => /^[\d\s/—-]+$/.test(s) && /\d|—/.test(s);
    const isDist = (s) => /^\d{1,2}$/.test(s);
    let idx = 0;
    if (
      cells.length >= 2 &&
      isDist(cells[0]) &&
      !isAir(cells[1]) &&
      /[\u3040-\u30ff\u4e00-\u9fff]/.test(cells[1])
    ) {
      dist = cells[0];
      idx = 1;
    }
    while (idx < cells.length) {
      const c = cells[idx];
      if (!isAir(c) || /[\u3040-\u30ff\u4e00-\u9fff]/.test(c)) {
        ships = c;
        idx++;
        break;
      }
      break;
    }
    for (; idx < cells.length; idx++) airs.push(cells[idx]);

    let a1 = "—", a2 = "—", a3 = "—";
    const cl = (v) => (v || "—").replace(/\s+/g, "");
    if (airs.length === 3) {
      a1 = cl(airs[0]); a2 = cl(airs[1]); a3 = cl(airs[2]);
    } else if (airs.length === 6) {
      a1 = cl(airs[0]) + "/" + cl(airs[1]);
      a2 = cl(airs[2]) + "/" + cl(airs[3]);
      a3 = cl(airs[4]) + "/" + cl(airs[5]);
    } else if (airs.length === 9) {
      // three configs of 3 — show first config primary, note range
      a1 = cl(airs[0]);
      a2 = cl(airs[1]);
      a3 = cl(airs[2]);
    } else if (airs.length === 4) {
      // 空劣/均/优/确 → use 均/优/确
      a1 = cl(airs[1]); a2 = cl(airs[2]); a3 = cl(airs[3]);
    } else if (airs.length === 8) {
      a1 = cl(airs[0]) + "/" + cl(airs[1]);
      a2 = cl(airs[2]) + "/" + cl(airs[3]);
      a3 = cl(airs[4]) + "/" + cl(airs[5]);
    } else if (airs.length > 0) {
      a1 = cl(airs[0]); a2 = cl(airs[1] || "—"); a3 = cl(airs[2] || "—");
    }
    rows.push({ node, dist, ships: compressShips(ships), a1, a2, a3 });
  }
  return rows;
}

function enemyTable(rows, { hard = false } = {}) {
  const out = [
    "| 点 | 敌舰（压缩） | 制空均势 | 优势 | 确保 |",
    "|----|--------------|----------|------|------|",
  ];
  for (const r of rows) {
    let ships = r.ships;
    if (hard) {
      const parts = ships.split(", ").map((x) => x.trim()).filter(Boolean);
      const keep = parts.filter((p) =>
        /空母|戦艦|軽母|重巡ネ|雷巡|姫|鬼|棲|飛行場|輸送ワ級flag|離島|砲台|集積/.test(p)
      );
      const drop = parts.length - keep.length;
      if (drop > 0 && keep.length) ships = keep.join(", ") + ` 等${drop}小船`;
    }
    const d = r.dist != null ? `（${r.dist}）` : "";
    out.push(`| ${r.node}${d} | ${ships} | ${r.a1} | ${r.a2} | ${r.a3} |`);
  }
  return out.join("\n");
}

function splitSections(mdRaw) {
  const md = String(mdRaw).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = md.split("\n");
  let fmEnd = -1;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") { fmEnd = i; break; }
    }
  }
  const frontmatter = fmEnd >= 0 ? lines.slice(0, fmEnd + 1) : [];
  const rest = lines.slice(fmEnd + 1);
  const pre = []; // before first ##
  const secs = [];
  let cur = null;
  for (const line of rest) {
    const m = line.match(/^## (.+)$/);
    if (m) {
      if (cur) secs.push(cur);
      else if (pre.length) {
        // keep pre (h1 + blockquote)
      }
      cur = { title: m[1].replace(/\r/g, "").trim(), lines: [] };
      continue;
    }
    if (!cur) pre.push(line);
    else cur.lines.push(line);
  }
  if (cur) secs.push(cur);
  return { frontmatter, pre, secs };
}

function isRawDumpLine(t) {
  if (/^−\s*(地图|关于|攻击机)/.test(t)) return true;
  if (/^\+\s*(地图|萌新|水雷|基斯|速吸|榨干)/.test(t)) return true;
  if (/^-\s*\+\s/.test(t)) return true;
  if (/^-\s*>/.test(t)) return true;
  if (/^-\s*(路线|需求|制空|索敌|任务ID|任务名称|任务要求|完成条件|推荐配置|推荐度)：?\s*$/.test(t))
    return true;
  return false;
}

function stripRawDumpIfTables(bodyLines, { untilStructured = false } = {}) {
  const hasTable = bodyLines.some((l) => /^\|/.test(l.trim()));
  const hasH3 = bodyLines.some((l) => /^###\s/.test(l.trim()));
  if (!hasTable && !hasH3) return bodyLines; // keep as-is

  const out = [];
  let seenStructured = false;
  for (const line of bodyLines) {
    const t = line.trim();
    if (/^\|/.test(t) || /^###\s/.test(t)) {
      seenStructured = true;
      out.push(line);
      continue;
    }
    if (!seenStructured) {
      // drop everything before first table/h3 when untilStructured
      if (untilStructured) continue;
      if (isRawDumpLine(t)) continue;
      if (/^-\s/.test(t) && t.length > 60) continue;
      if (/^−\s*/.test(t) || /^\+\s*/.test(t)) continue;
      if (t) out.push(line);
      else if (out.length) out.push(line);
      continue;
    }
    // after structured: drop raw-dump leftovers and analysis popups
    if (isRawDumpLine(t)) continue;
    if (/^−\s*关于/.test(t) || /^-\s*−\s*关于/.test(t)) continue;
    if (/^-\s*−\s*攻击机/.test(t) || /^−\s*攻击机/.test(t)) continue;
    out.push(line);
  }
  // collapse leading blanks
  while (out.length && !out[0].trim()) out.shift();
  return out;
}

function build(id) {
  const md = readFileSync(join(MAPS_DIR, `${id}.md`), "utf8");
  const meta = JSON.parse(readFileSync(join(META_DIR, `${id}.json`), "utf8"));
  const { frontmatter, pre, secs } = splitSections(md);

  // Map original titles → buckets
  const buckets = {
    info: null,
    routing: null,
    air: null,
    fleet: null,
    quest: null,
    extras: [], // become ### under 推荐编成
    drop: [],
  };

  for (const s of secs) {
    const mapped = H2_MAP[s.title];
    if (mapped === "地图信息" && !buckets.info) buckets.info = s;
    else if (mapped === "带路条件" && !buckets.routing) buckets.routing = s;
    else if (mapped === "制空 / 索敌" && !buckets.air) buckets.air = s;
    else if (mapped === "推荐编成" && !buckets.fleet) buckets.fleet = s;
    else if (mapped === "任务配置" && !buckets.quest) buckets.quest = s;
    else if (mapped === "备注" && !buckets.extras.some((x) => x.title === "备注"))
      buckets.extras.push(s);
    else if (s.title === "原帖") buckets.drop.push(s);
    else buckets.extras.push(s);
  }

  // Special: 6-4 — if 带路条件 has contaminated dump (no B-D-C-F-N table),
  // rebuild routing body from the good ### 左路/右路 tables inside routing or fleet
  let routingLines = buckets.routing ? [...buckets.routing.lines] : [];
  const routingText = routingLines.join("\n");
  const metaRoutes = [...meta.routing.matchAll(/([A-Z](?:-[A-Z0-9()]+)+)路线/g)].map((m) => m[1]);
  const hasGood64 = /B-D-C-F-N/.test(routingText) && /\|/.test(routingText);
  if (id === "6-4" && !hasGood64) {
    // Find left/right tables in extras or anywhere
    const allText = secs.map((s) => s.lines.join("\n")).join("\n");
    const leftIdx = allText.indexOf("### 左路");
    if (leftIdx >= 0) {
      const tail = allText.slice(leftIdx);
      routingLines = [
        "",
        "C 点有双撸爷坐镇，不能带空母，很难先手阻止劝退。左路主流；右路高难度不推荐。",
        "",
        ...tail.split("\n"),
      ];
      buckets.extras = buckets.extras.filter((s) => !s.lines.join("\n").includes("### 左路"));
    } else {
      const body = meta.routing
        .replace(/^带路条件[^\n]*\n/, "")
        .replace(/−\s*地图(分析|简介)[^\n]*\n/, "")
        .replace(/−\s*关于[\s\S]*$/, "")
        .replace(/−\s*攻击机安全[\s\S]*$/, "")
        .trim();
      routingLines = body.split("\n").map((l) => (l.trim() ? `- ${l.trim()}` : ""));
    }
  } else if (id === "6-4") {
    // has left/right tables inside routing — drop contaminated leading dump entirely
    routingLines = stripRawDumpIfTables(routingLines, { untilStructured: true });
    if (!routingLines.join("\n").includes("C 点有双撸爷") && !routingLines.join("\n").includes("C点有双撸爷")) {
      routingLines = [
        "C 点有双撸爷坐镇，不能带空母，很难先手阻止劝退。左路主流；右路高难度不推荐。",
        "",
        ...routingLines,
      ];
    }
  } else if (id === "5-5" || id === "5-6" || id === "6-5") {
    // Keep structured route tables; drop leading NGA dump (analysis lives in 地图信息 / extras)
    routingLines = stripRawDumpIfTables(routingLines, { untilStructured: true });
  } else {
    routingLines = stripRawDumpIfTables(routingLines);
  }

  // Fleet body
  const fleetLines = buckets.fleet ? [...buckets.fleet.lines] : [];
  // Fold extras as ###
  const folded = [];
  for (const s of buckets.extras) {
    const body = s.lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
    if (!body.trim() || body.trim() === "—") continue;
    folded.push(`### ${s.title}`, "", body, "");
  }

  // 5-5: ensure 流派/倍卡 notes stay under 推荐编成 (already folding extras)
  // 5-6 海域倍卡 is an extra → folded

  const enemyRows = parseEnemy(meta.enemy);
  const etable = enemyTable(enemyRows, { hard: id === "5-6" || id === "6-4" });

  const infoBody = (() => {
    const t = buckets.info
      ? buckets.info.lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim()
      : "";
    if (t && t !== "—") return t;
    // fallback: first 2–3 non-route bullets from meta.routing
    const raw = meta.routing
      .replace(/^带路条件[^\n]*\n/, "")
      .replace(/−\s*地图(分析|简介)[^\n]*\n/, "");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/路线[：:]/.test(l) && !/^各种攻略/.test(l) && !/^−/.test(l) && !/^\+/.test(l))
      .slice(0, 3);
    return lines.length ? lines.map((l) => `- ${l}`).join("\n") : "—";
  })();
  const airBody = buckets.air
    ? buckets.air.lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim()
    : "—";
  const questBody = buckets.quest
    ? buckets.quest.lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim()
    : "—";

  const source = (frontmatter.join("\n").match(/source:\s*"([^"]+)"/) || [])[1] || meta.source_url || "";
  let routingBody = routingLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim();
  if (source && !routingBody.includes("来源")) {
    routingBody = `> 来源：${source}（NGA「带路条件」弹窗）\n\n${routingBody}`;
  }

  const stillMissing = metaRoutes.filter(
    (r) => !routingBody.includes(r) && !fleetLines.join("\n").includes(r)
  );

  const remarks = ["改造名须 Data MCP 核实；敌配以 meta.enemy 为准。"];
  if (stillMissing.length)
    remarks.push(`meta 路由中出现、正文未展开的路线：${stillMissing.join("、")}`);
  if (id === "5-5")
    remarks.push("流派/支援/偷窥等笔记见「推荐编成」；上路雷爷劝退率高，任务非必须勿走上路。");
  if (id === "5-6")
    remarks.push("P1/P2/P3 分段；海域倍卡见「推荐编成」。");
  if (id === "6-4")
    remarks.push(
      "原 md 带路顶部曾混入他图 dump，已改用左路/右路表（与 meta.routing 一致）。左路主流，右路不推荐。"
    );
  if (id === "6-5") remarks.push("需 2 队陆航；下路核心船伊势改二。");

  // Assemble — keep pre (h1 + note)
  const parts = [];
  if (frontmatter.length) parts.push(frontmatter.join("\n"));
  parts.push(pre.join("\n").replace(/^\n+/, "").replace(/\n+$/, ""));
  parts.push("");
  parts.push("## 地图信息");
  parts.push("");
  parts.push(infoBody || "—");
  parts.push("");
  parts.push("## 带路条件");
  parts.push("");
  parts.push(routingBody || "—");
  parts.push("");
  parts.push("## 敌方配置");
  parts.push("");
  parts.push(etable);
  parts.push("");
  parts.push("## 制空 / 索敌");
  parts.push("");
  parts.push(airBody || "—");
  parts.push("");
  parts.push("## 推荐编成");
  parts.push("");
  const fleetBlock = [fleetLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, ""), ...folded]
    .filter((x) => x != null && String(x).trim() !== "")
    .join("\n\n");
  parts.push(fleetBlock || "—");
  parts.push("");
  parts.push("## 任务配置");
  parts.push("");
  parts.push(questBody || "—");
  parts.push("");
  parts.push("## 备注");
  parts.push("");
  parts.push(remarks.map((r) => `- ${r}`).join("\n"));
  parts.push("");

  let out = parts.join("\n");
  out = out.replace(/\n{4,}/g, "\n\n\n");
  out = out.replace(/^---\n([\s\S]*?)---\n(?!\n)/, "---\n$1---\n\n");
  return {
    id,
    out,
    nEnemy: enemyRows.length,
    stillMissing,
    headings: [...out.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
  };
}

for (const id of IDS) {
  const r = build(id);
  writeFileSync(join(MAPS_DIR, `${id}.md`), r.out, "utf8");
  console.log(
    `OK ${id} enemies=${r.nEnemy} bytes=${r.out.length} H=[${r.headings.join(" | ")}] miss=${r.stillMissing.join(",") || "-"}`
  );
}
