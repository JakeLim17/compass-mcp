/**
 * Smoke tests for connect merge helpers (temp dirs only — never touches ~/.cursor).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SERVER_NAME,
  buildMcpServerConfig,
  mergeCodexToml,
  mergeMcpJson,
  repoRoot,
  stripCodexMcpSection,
} from "./connectLib.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-connect-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testMergeMcpJson(): void {
  withTempDir((dir) => {
    const filePath = path.join(dir, "mcp.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        mcpServers: {
          other: { command: "echo", args: ["hi"] },
        },
      }),
    );

    const root = repoRoot();
    mergeMcpJson(filePath, SERVER_NAME, buildMcpServerConfig(root, "cursor"));
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      mcpServers: Record<string, { env?: { COMPASS_MCP_HOST?: string } }>;
    };

    assert(parsed.mcpServers.other !== undefined, "existing server preserved");
    assert(parsed.mcpServers[SERVER_NAME]?.env?.COMPASS_MCP_HOST === "cursor", "cursor host env");
    const backups = fs.readdirSync(dir).filter((f) => f.startsWith("mcp.json.bak."));
    assert(backups.length === 1, "exactly one backup file");
  });
}

function testMergeCodexToml(): void {
  withTempDir((dir) => {
    const filePath = path.join(dir, "config.toml");
    fs.writeFileSync(filePath, "[mcp_servers.other]\ncommand = \"echo\"\n");

    mergeCodexToml(filePath, repoRoot(), "codex");
    const content = fs.readFileSync(filePath, "utf8");
    assert(content.includes("[mcp_servers.other]"), "other server preserved");
    assert(content.includes("[mcp_servers.compass-mcp]"), "compass section added");
    assert(content.includes('COMPASS_MCP_HOST = "openai"'), "codex maps to openai host");

    mergeCodexToml(filePath, repoRoot(), "codex");
    const after = fs.readFileSync(filePath, "utf8");
    const matchesAfter = after.match(/\[mcp_servers\.compass-mcp\]/g) ?? [];
    assert(matchesAfter.length === 1, "re-merge replaces single compass block");
  });
}

function testStripCodexSection(): void {
  const input = `[mcp_servers.a]
x = 1

[mcp_servers.compass-mcp]
command = "node"

[mcp_servers.compass-mcp.env]
COMPASS_MCP_HOST = "openai"

[mcp_servers.b]
y = 2
`;
  const out = stripCodexMcpSection(input, SERVER_NAME);
  assert(!out.includes("compass-mcp"), "compass block removed");
  assert(out.includes("[mcp_servers.a]"), "a kept");
  assert(out.includes("[mcp_servers.b]"), "b kept");
}

function main(): void {
  const tests = [
    ["mergeMcpJson", testMergeMcpJson],
    ["mergeCodexToml", testMergeCodexToml],
    ["stripCodexSection", testStripCodexSection],
  ] as const;

  for (const [name, fn] of tests) {
    fn();
    console.log(`ok ${name}`);
  }
  console.log("connect smoke: all passed");
}

main();
