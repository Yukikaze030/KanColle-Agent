import { execFileSync } from "node:child_process";

/** Try the raw URL, then GitHub's Contents API when the raw host is unreachable. */
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
  }
  try {
    return JSON.parse(execFileSync("curl", ["--fail", "--silent", "--show-error", "--location", "--max-time", "30", url], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    }));
  } catch (error) {
    const raw = new URL(url);
    if (raw.hostname === "raw.githubusercontent.com") {
      const [, owner, repo, ref, ...file] = raw.pathname.split("/");
      const contents = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${file.join("/")}`);
      contents.searchParams.set("ref", ref);
      console.warn(`Raw download failed for ${url}; trying the same ref via the GitHub Contents API`);
      try {
        const response = await fetch(contents, {
          headers: { accept: "application/vnd.github.raw+json", "user-agent": "kancolle-agent-data-mcp/1.0" },
          signal: AbortSignal.timeout(90_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (apiError) {
        console.warn(`GitHub Contents API download failed: ${String(apiError)}`);
      }
    }
    throw new Error(`Unable to fetch ${url}; retry the download or rebuild from the checked-in cache.`, { cause: error });
  }
}
