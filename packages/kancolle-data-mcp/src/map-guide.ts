import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MAP_GUIDE_MODULES = [
  "overview",
  "routing",
  "enemy",
  "air-los",
  "bonus",
  "fleets",
  "quests",
  "notes",
] as const;

export type MapGuideModule = typeof MAP_GUIDE_MODULES[number];

interface ParsedGuide {
  map: string;
  title: string;
  metadata: Record<string, string | boolean>;
  available_modules: Array<{ key: string; title: string }>;
  modules: Record<string, { title: string; content: string }>;
}

function guideDirectories(): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return [
    process.env.KANCOLLE_MAP_GUIDE_DIR,
    join(process.cwd(), ".opencode", "skills", "fleet-builder", "refs", "maps"),
    resolve(moduleDir, "../../../.opencode/skills/fleet-builder/refs/maps"),
  ].filter((value): value is string => Boolean(value));
}

function parseScalar(value: string): string | boolean {
  const unquoted = value.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  return unquoted;
}

export function parseMapGuide(markdown: string): ParsedGuide {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---\n/);
  const metadata: Record<string, string | boolean> = {};
  if (frontmatter) {
    for (const line of frontmatter[1].split("\n")) {
      const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (match) metadata[match[1]] = parseScalar(match[2]);
    }
  }
  const body = frontmatter ? normalized.slice(frontmatter[0].length) : normalized;
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const headings = [...body.matchAll(/^##\s+\[module:([a-z-]+)\]\s+(.+)$/gm)];
  const modules: Record<string, { title: string; content: string }> = {};
  for (let i = 0; i < headings.length; i += 1) {
    const key = headings[i][1];
    const heading = headings[i][2].trim();
    const start = (headings[i].index ?? 0) + headings[i][0].length;
    const end = headings[i + 1]?.index ?? body.length;
    if (modules[key]) throw new Error(`duplicate_map_module:${key}`);
    const content = body.slice(start, end).trim();
    if (!content) throw new Error(`empty_map_module:${key}`);
    modules[key] = { title: heading, content };
  }
  return {
    map: String(metadata.map ?? title.split(/\s+/)[0] ?? ""),
    title,
    metadata,
    available_modules: Object.entries(modules).map(([key, value]) => ({ key, title: value.title })),
    modules,
  };
}

export function loadMapGuide(map: string, requestedModules: string[] = []): ParsedGuide {
  if (!/^\d+-\d+$/.test(map)) throw new Error("invalid_map_id");
  const path = guideDirectories().map(dir => join(dir, `${map}.md`)).find(existsSync);
  if (!path) throw new Error("map_guide_not_found");
  const parsed = parseMapGuide(readFileSync(path, "utf8"));
  const required = ["overview", "routing", "enemy", "air-los", "fleets", "quests", "notes"];
  const missingRequired = required.filter(key => !(key in parsed.modules));
  if (missingRequired.length) throw new Error(`invalid_map_guide:missing:${missingRequired.join(",")}`);
  if (parsed.map !== map || !parsed.title.startsWith(`[map:${map}] `)) throw new Error("invalid_map_guide:identity");
  const selected = requestedModules.length ? requestedModules : [];
  const modules = Object.fromEntries(selected.filter(key => key in parsed.modules).map(key => [key, parsed.modules[key]]));
  return { ...parsed, modules };
}
