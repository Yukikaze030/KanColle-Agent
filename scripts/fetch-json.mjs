import { execFileSync } from "node:child_process";

/** Node fetch first; curl also supports hosts whose networking differs from Node's. */
export async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "kancolle-agent-data-mcp/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Node fetch failed for ${url}; trying curl: ${String(error)}`);
    try {
      return JSON.parse(execFileSync("curl", ["--fail", "--silent", "--show-error", "--location", "--max-time", "30", url], {
        encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
      }));
    } catch {
      throw new Error(`Unable to fetch ${url}; no data written. Retry or provide the pinned master file via KANCOLLE_MASTER_FILE.`);
    }
  }
}
