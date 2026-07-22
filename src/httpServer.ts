#!/usr/bin/env node
/**
 * compass-mcp — Streamable HTTP MCP (Claude.ai / ChatGPT / Cursor remote / web).
 * Protocol: MCP Streamable HTTP (GET/POST/DELETE on /mcp).
 */
import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getServerVersion, SERVER_NAME } from "./constants.js";
import { createCompassMcpServer } from "./createCompassMcpServer.js";
import { createApiKeyMiddleware, createCorsMiddleware } from "./httpAuth.js";
import {
  HttpServerConfig,
  loadHttpConfig,
  validateHttpStartup,
} from "./httpConfig.js";

const transports: Record<string, StreamableHTTPServerTransport> = {};

function normalizeMcpPath(path: string): string {
  const trimmed = path.trim() || "/mcp";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Build Express app — exported for smoke tests. */
export function createHttpApp(config: HttpServerConfig = loadHttpConfig()): Express {
  const mcpPath = normalizeMcpPath(config.mcpPath);
  const allowedHosts =
    config.host === "0.0.0.0" || config.host === "::"
      ? ["localhost", "127.0.0.1", "[::1]"]
      : undefined;

  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts,
  });

  app.use(createCorsMiddleware(config));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: SERVER_NAME,
      version: getServerVersion(),
      transport: "streamable-http",
      mcp_path: mcpPath,
    });
  });

  const protectedMcp = [createApiKeyMiddleware(config)];

  app.all(mcpPath, ...protectedMcp, async (req, res) => {
    try {
      const sessionHeader = req.headers["mcp-session-id"];
      const sessionId = Array.isArray(sessionHeader)
        ? sessionHeader[0]
        : sessionHeader;

      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (
        !sessionId &&
        req.method === "POST" &&
        isInitializeRequest(req.body)
      ) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            if (transport) transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };

        const server = createCompassMcpServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[compass-mcp] MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  return app;
}

export async function startHttpServer(
  config: HttpServerConfig = loadHttpConfig(),
): Promise<{ app: Express; port: number; mcpPath: string }> {
  validateHttpStartup(config);
  const mcpPath = normalizeMcpPath(config.mcpPath);
  const app = createHttpApp(config);

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      console.log(
        `[compass-mcp] HTTP MCP listening on http://${config.host}:${config.port}${mcpPath}`,
      );
      console.log(
        `[compass-mcp] Health: http://${config.host}:${config.port}/health`,
      );
      resolve({ app, port: config.port, mcpPath });
    });
    server.on("error", reject);
  });
}

async function main() {
  const config = loadHttpConfig();
  await startHttpServer(config);

  const shutdown = async () => {
    for (const sid of Object.keys(transports)) {
      try {
        await transports[sid]?.close();
      } catch {
        /* ignore */
      }
      delete transports[sid];
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

const isMain =
  process.argv[1]?.endsWith("httpServer.js") ||
  process.argv[1]?.endsWith("httpServer.ts");

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
