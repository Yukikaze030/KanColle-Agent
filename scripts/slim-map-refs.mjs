/**
 * Slim fleet-builder/refs/maps/*.md — keep enemy fleets, routing, map tips, quests.
 * Drops NGA UI chrome, vote lines, generic newbie boilerplate, empty air tables.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(
  process.cwd(),
  ".opencode",
  "skills",
  "fleet-builder",
  "refs",
  "maps",
);

/** Lines that are pure NGA chrome / empty table scaffolding. */
function isChrome(t) {
  if (!t) return true;
  if (t === "R" || t === "R " || t === "+ 地图 ..." || t === "− 地图 ...") return true;
  if (/^地图(新窗口)/.test(t)) return true;
  if (/^敌方详细配置/.test(t)) return true;
  if (/^[+\-−]\s*(地图|敌方最高制空配置|.*\.\.\.)\s*$/.test(t)) return true;
  if (/^UID:/.test(t) || /^级别:/.test(t) || /^声望:/.test(t) || /^注册:/.test(t) || /^威望:/.test(t)) return true;
  if (/^\d+×$/.test(t)) return true;
  if (/^(附件|显示全部附件|改动|热点回复)$/.test(t)) return true;
  if (/^在\d{4}-\d{2}-\d{2}/.test(t) && /修改/.test(t)) return true;
  if (/^\[quote\]$|^\[\/?collapse|^\[list\]$|^\[\/list\]$|^\[\*\]$/.test(t)) return true;
  if (/点击显示隐藏的内容/.test(t)) return true;
  if (/^对空射击回避补正$|^攻击机安全搭载数$|^全图$/.test(t)) return true;
  if (/^(制空均势|制空优势|制空确保|战斗点|敌舰配置)$/.test(t)) return true;
  if (/^[01]\.\d\s*\/\s*[01]\.\d$/.test(t)) return true;
  if (/^新窗口$/.test(t)) return true;
  return false;
}

/** Generic newbie advice identical across maps — drop from per-map files. */
function isGenericAdvice(t) {
  return (
    /如果在A点\(道中\)有船大破/.test(t) ||
    /昼战如果没打完可以进夜战/.test(t) ||
    /关于阵型的选择，无脑一点说/.test(t) ||
    /1-1道中战斗进夜战没多大问题/.test(t)
  );
}

function extractBody(md) {
  const i = md.indexOf("```text");
  const j = md.indexOf("```", i + 7);
  if (i < 0) return "";
  return md.slice(i + 7, j > i ? j : undefined);
}

function parseSource(md) {
  return (md.match(/^source: "([^"]+)"/m) || [])[1] || "";
}

function getTitle(md, mapId) {
  const m = md.match(/^# (.+)$/m);
  return (m ? m[1] : mapId).trim();
}

function cleanAndGroup(raw) {
  const lines = raw.split(/\r?\n/);
  const enemies = [];
  const routing = [];
  const analysis = [];
  const quests = [];
  const notes = [];
  let section = "notes"; // notes until we hit known headers

  const headerRe = /^(带路条件|地图分析|各攻略路线|攻略路线|路线)/;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].replace(/\t/g, " ").trim();
    if (isChrome(t)) continue;
    if (isGenericAdvice(t)) continue;
    if (/^新手需要的一点知识/.test(t)) {
      section = "notes";
      continue;
    }
    if (/^关于刷闪的配置/.test(t)) {
      section = "notes";
      notes.push("### 刷闪配置");
      continue;
    }
    if (headerRe.test(t) && t.length < 24) {
      section = "routing";
      continue;
    }
    if (/地图分析/.test(t) && t.length < 16) {
      section = "analysis";
      continue;
    }
    if (/^任务ID$|^任务名称$/.test(t)) {
      section = "quests";
      quests.push("| 任务 | 要求 | 条件 | 配置 |");
      quests.push("|------|------|------|------|");
      continue;
    }

    // enemy node
    if (/^[A-Z]$/.test(t)) {
      const ships = (lines[i + 1] || "").replace(/\t/g, " ").trim();
      if (ships && /級|级|flagship|elite|後期|軽母|空母|駆逐|重巡|軽巡|戦艦|潜水|雷巡|補給/.test(ships)) {
        const nums = [];
        for (let k = i + 2; k < Math.min(i + 5, lines.length); k++) {
          const v = (lines[k] || "").trim();
          if (/^\d+$/.test(v)) nums.push(v);
          else break;
        }
        const air = nums.length ? ` · 制空 ${nums.join("/")}` : "";
        enemies.push(`- **${t}** ${ships}${air}`);
        i += 1 + nums.length;
        continue;
      }
    }

    if (section === "quests") {
      // keep compact quest-ish lines
      if (/^B\d+|^\[B|S胜|A胜|B胜|到达|次/.test(t) || t.length > 8) quests.push(t);
      continue;
    }
    if (section === "routing") routing.push(t);
    else if (section === "analysis") analysis.push(t);
    else notes.push(t);
  }

  const joinBlock = (title, arr) => {
    const body = arr
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!body || body.length < 15) return "";
    return `## ${title}\n\n${body}`;
  };

  // notes: drop if too short or mostly empty
  const notesBody = notes
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const parts = [
    joinBlock("[module:overview] 地图信息", analysis),
    joinBlock("[module:routing] 带路条件", routing),
    enemies.length ? `## [module:enemy] 敌方配置\n\n${enemies.join("\n")}` : "",
    joinBlock("[module:quests] 任务配置", quests),
    notesBody.length > 40 ? `## [module:notes] 备注\n\n${notesBody}` : "",
  ].filter(Boolean);

  return parts.join("\n\n").trim();
}

function rewrite(file) {
  const mapId = file.replace(/\.md$/, "");
  const md = readFileSync(join(dir, file), "utf8");
  const source = parseSource(md);
  const title = getTitle(md, mapId);
  const raw = extractBody(md);
  const body = cleanAndGroup(raw);
  const out = `---
era: "2"
source: "${source}"
updated: "2026-09-12"
summary: "常规图 ${title}（敌配置/带路/分析/任务精简）"
map: "${mapId}"
slim: true
---

# [map:${mapId}] ${title}

> NGA 梦美常规图带路 · 二期 · 改造名以 Data MCP `kc_ship_remodel` 为准

${body}
`;
  writeFileSync(join(dir, file), out, "utf8");
  const ratio = raw.length ? Math.round((out.length / raw.length) * 100) : 100;
  console.log(`${file}  ${raw.length} -> ${out.length}  (${ratio}%)`);
}

const files = readdirSync(dir)
  .filter((f) => /^[1-7]-[1-6]\.md$/.test(f))
  .sort();
for (const f of files) rewrite(f);
console.log("slimmed", files.length);
