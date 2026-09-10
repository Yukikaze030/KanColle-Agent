#!/usr/bin/env node
/**
 * Standalone PoC MCP server for development without Poi.
 * Loads mock player fixture and listens on localhost HTTP.
 */
import { createPoiRuntime } from "./plugin.js";

async function main() {
  const port = Number(process.env.POI_MCP_PORT ?? 39271);
  const runtime = createPoiRuntime();
  await runtime.start({ port, useMock: true });
  console.error(
    `poi-plugin-kancolle-mcp listening on http://127.0.0.1:${port}/mcp (mock player loaded)`,
  );
  console.error(`snapshot_version=${runtime.store.version()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
