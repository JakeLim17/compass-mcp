import os from "node:os";

export interface HttpServerConfig {
  host: string;
  port: number;
  mcpPath: string;
  apiKey?: string;
  corsOrigins: string[];
  /** When true, non-local clients may connect without an API key (dev only). */
  allowRemoteNoKey: boolean;
}

const DEFAULT_CORS = [
  "https://claude.ai",
  "https://www.claude.ai",
  "https://chatgpt.com",
  "https://www.chatgpt.com",
  "https://cursor.com",
  "https://www.cursor.com",
];

function parseCors(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_CORS;
  if (raw.trim() === "*") return ["*"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadHttpConfig(): HttpServerConfig {
  const host = process.env.COMPASS_MCP_HOST?.trim() || "127.0.0.1";
  const port = parseInt(process.env.COMPASS_MCP_PORT ?? "3920", 10);
  const mcpPath = process.env.COMPASS_MCP_PATH?.trim() || "/mcp";
  const apiKey = process.env.COMPASS_MCP_API_KEY?.trim() || undefined;
  const corsOrigins = parseCors(process.env.COMPASS_MCP_CORS);
  const allowRemoteNoKey =
    process.env.COMPASS_MCP_ALLOW_REMOTE_NO_KEY === "true";

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid COMPASS_MCP_PORT: ${process.env.COMPASS_MCP_PORT}`);
  }

  return {
    host,
    port,
    mcpPath,
    apiKey,
    corsOrigins,
    allowRemoteNoKey,
  };
}

export function isLocalAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.replace(/^::ffff:/, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

export function validateHttpStartup(config: HttpServerConfig): void {
  const isLocalBind =
    config.host === "127.0.0.1" ||
    config.host === "localhost" ||
    config.host === "::1";
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !config.apiKey) {
    console.error(
      "[compass-mcp] NODE_ENV=production — set COMPASS_MCP_API_KEY before exposing HTTP MCP.",
    );
    process.exit(1);
  }

  if (!isLocalBind && !config.apiKey && !config.allowRemoteNoKey) {
    console.error(
      `[compass-mcp] Binding to ${config.host} without COMPASS_MCP_API_KEY. ` +
        "Set the key or use COMPASS_MCP_HOST=127.0.0.1 for local-only.",
    );
    process.exit(1);
  }

  if (!config.apiKey && isLocalBind) {
    console.warn(
      "[compass-mcp] COMPASS_MCP_API_KEY unset — localhost-only mode. " +
        "Set a key before tunneling to Claude.ai / ChatGPT.",
    );
  }
}

export function localNetworkHint(): string {
  const ifaces = os.networkInterfaces();
  const addrs: string[] = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addrs.push(iface.address);
      }
    }
  }
  return addrs[0] ?? "127.0.0.1";
}
