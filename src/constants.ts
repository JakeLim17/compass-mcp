import { getVersionInfo } from "./version.js";

export const SERVER_NAME = "compass-mcp";

/** Package version from package.json — single SSOT for MCP responses. */
export function getServerVersion(): string {
  return getVersionInfo({ skip_fetch: true }).version;
}
