#!/usr/bin/env node
/**
 * compass-mcp — stdio entry (Cursor local MCP).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCompassMcpServer } from "./createCompassMcpServer.js";

async function main() {
  const server = createCompassMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
