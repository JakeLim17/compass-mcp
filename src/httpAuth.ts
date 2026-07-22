import type { Request, Response, NextFunction } from "express";
import { HttpServerConfig, isLocalAddress } from "./httpConfig.js";

function parseBearer(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function createCorsMiddleware(config: HttpServerConfig) {
  const allowAll = config.corsOrigins.includes("*");

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (allowAll) {
      res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
    } else if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, mcp-session-id, Mcp-Session-Id",
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function createApiKeyMiddleware(config: HttpServerConfig) {
  let warnedRemote = false;

  return (req: Request, res: Response, next: NextFunction) => {
    if (config.apiKey) {
      const token = parseBearer(req.headers.authorization);
      if (token !== config.apiKey) {
        res.status(401).json({
          error: "Unauthorized",
          hint: "Send Authorization: Bearer <COMPASS_MCP_API_KEY>",
        });
        return;
      }
      next();
      return;
    }

    const local = isLocalAddress(req.socket.remoteAddress);
    if (local) {
      next();
      return;
    }

    if (config.allowRemoteNoKey && process.env.NODE_ENV !== "production") {
      if (!warnedRemote) {
        console.warn(
          "[compass-mcp] Remote request without API key (COMPASS_MCP_ALLOW_REMOTE_NO_KEY=true, dev only)",
        );
        warnedRemote = true;
      }
      next();
      return;
    }

    res.status(401).json({
      error: "Unauthorized",
      hint:
        "Non-localhost requests require COMPASS_MCP_API_KEY (Bearer token).",
    });
  };
}
