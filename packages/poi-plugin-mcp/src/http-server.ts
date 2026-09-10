import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isAuthorized } from "./auth.js";
import { createPoiMcpServer } from "./mcp-server.js";
import type { SnapshotStore } from "./snapshot.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HttpServerOptions {
  host?: string;
  port?: number;
  token?: string;
}

export interface RunningHttpServer {
  port: number;
  close: () => Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type, accept, mcp-session-id",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  });
  res.end(text);
}

/**
 * Stateless Streamable HTTP MCP + /health.
 * New transport per request — avoids session/SSE state bugs across clients.
 */
export async function startPoiHttpServer(
  store: SnapshotStore,
  options: HttpServerOptions = {},
): Promise<RunningHttpServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 39271;
  const token = options.token;

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url ?? "/", `http://${host}:${port}`);

      // Liveness for UI panel — no auth, no MCP
      if (url.pathname === "/health") {
        const snap = store.get();
        sendJson(res, 200, {
          ok: true,
          online: true,
          player_logged_in: snap.player_logged_in,
          snapshot_version: snap.version,
          ships: snap.ships.length,
          equipment: snap.equipment.length,
          resources: snap.resources,
          resources_coverage: snap.resources
            ? "complete"
            : snap.inventory.materials_coverage,
          materials_coverage: snap.inventory.materials_coverage,
          useitems_coverage: snap.inventory.useitems_coverage,
          generated_at: snap.generated_at,
        });
        return;
      }

      if (url.pathname !== "/mcp") {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (!isAuthorized(req.headers.authorization, token)) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, { error: "method_not_allowed" });
        return;
      }

      const raw = await readBody(req);
      let parsed: unknown = undefined;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          sendJson(res, 400, { error: "invalid_json" });
          return;
        }
      }

      // Fresh server+transport per request (stateless JSON)
      const mcpServer = createPoiMcpServer(store);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await mcpServer.connect(transport);

      res.on("close", () => {
        void transport.close().catch(() => undefined);
        void mcpServer.close().catch(() => undefined);
      });

      await transport.handleRequest(req, res, parsed);
    } catch (err) {
      console.error("[poi-plugin-kancolle-mcp] request error:", err);
      sendJson(res, 500, { error: String(err) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, () => resolve());
  });

  console.log(`[poi-plugin-kancolle-mcp] listening http://${host}:${port}/mcp (health: /health)`);

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        http.close(() => resolve());
      }),
  };
}
