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

/**
 * Minimal Streamable HTTP MCP endpoint.
 * Authorization: Bearer <token> when token is set.
 * Only binds 127.0.0.1 by default.
 */
export async function startPoiHttpServer(
  store: SnapshotStore,
  options: HttpServerOptions = {},
): Promise<RunningHttpServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 39271;
  const token = options.token;

  const mcpServer = createPoiMcpServer(store);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcpServer.connect(transport);

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!isAuthorized(req.headers.authorization, token)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, () => resolve());
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        http.close(() => resolve());
      }),
  };
}
