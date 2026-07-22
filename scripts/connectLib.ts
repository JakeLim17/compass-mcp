/**
 * Shared helpers for `npm run connect` — MCP registration without manual JSON paste.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_NAME = "compass-mcp";

export type ConnectTarget = "cursor" | "claude" | "codex";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function serverJsPath(root = repoRoot()): string {
  return path.join(root, "dist", "server.js");
}

export function hostEnv(target: ConnectTarget): Record<string, string> {
  if (target === "codex") return { COMPASS_MCP_HOST: "openai" };
  return { COMPASS_MCP_HOST: target };
}

export function buildMcpServerConfig(root: string, target: ConnectTarget) {
  return {
    command: "node",
    args: [serverJsPath(root)],
    env: hostEnv(target),
  };
}

export function claudeMcpAddJson(root: string, target: ConnectTarget) {
  const cfg = buildMcpServerConfig(root, target);
  return JSON.stringify({
    type: "stdio",
    command: cfg.command,
    args: cfg.args,
    env: cfg.env,
  });
}

export function backupFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const backup = `${filePath}.bak.${Date.now()}`;
  fs.copyFileSync(filePath, backup);
  return backup;
}

export function mergeMcpJson(
  filePath: string,
  serverName: string,
  serverConfig: Record<string, unknown>,
): { backup: string | null; filePath: string } {
  const backup = backupFile(filePath);
  let config: { mcpServers?: Record<string, unknown> } = {};
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (raw) {
      config = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    }
  }
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }
  config.mcpServers[serverName] = serverConfig;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { backup, filePath };
}

export function cursorMcpPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function claudeDesktopConfigPath(): string {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

export function codexConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

/** Remove an existing [mcp_servers.<name>] block (and nested .env table). */
export function stripCodexMcpSection(content: string, serverName: string): string {
  const blockRe = new RegExp(
    String.raw`\n?\[mcp_servers\.${serverName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\.[^\]]+)?\][^\[]*`,
    "g",
  );
  return content.replace(blockRe, "").trimEnd();
}

export function mergeCodexToml(
  filePath: string,
  root: string,
  target: ConnectTarget,
): { backup: string | null; filePath: string } {
  const backup = backupFile(filePath);
  const cfg = buildMcpServerConfig(root, target);
  const argsToml = cfg.args.map((a) => JSON.stringify(a)).join(", ");
  const section = `
[mcp_servers.${SERVER_NAME}]
command = ${JSON.stringify(cfg.command)}
args = [${argsToml}]

[mcp_servers.${SERVER_NAME}.env]
COMPASS_MCP_HOST = ${JSON.stringify(cfg.env.COMPASS_MCP_HOST)}
`;

  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const stripped = stripCodexMcpSection(existing, SERVER_NAME);
  const next = `${stripped}${section.startsWith("\n") ? "" : "\n"}${section.trimStart()}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, "utf8");
  return { backup, filePath };
}

export function commandExists(name: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const full =
      process.platform === "win32"
        ? path.join(dir, `${name}.exe`)
        : path.join(dir, name);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export function restartHint(target: ConnectTarget, locale: "ko" | "en" = "ko"): string[] {
  if (locale === "en") {
    switch (target) {
      case "cursor":
        return [
          "Restart or refresh MCP in Cursor: Cmd/Ctrl+Shift+J → Tools & MCP → toggle compass-mcp OFF/ON.",
        ];
      case "claude":
        return [
          "Restart Claude Code or Claude Desktop so the new MCP server loads.",
        ];
      case "codex":
        return ["Restart Codex CLI / IDE extension so config.toml reloads."];
    }
  }
  switch (target) {
    case "cursor":
      return [
        "Cursor에서 MCP 새로고침: Cmd/Ctrl+Shift+J → Tools & MCP → compass-mcp 토글 OFF/ON.",
      ];
    case "claude":
      return [
        "Claude Code 또는 Claude Desktop을 재시작해 MCP 서버를 다시 로드하세요.",
      ];
    case "codex":
      return ["Codex CLI / IDE 확장을 재시작해 config.toml 변경을 반영하세요."];
  }
}
