#!/usr/bin/env node
/**
 * One-command MCP registration for Cursor / Claude Code / Codex.
 *
 * Usage:
 *   npm run connect -- cursor
 *   npm run connect -- claude
 *   npm run connect -- codex
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  SERVER_NAME,
  buildMcpServerConfig,
  claudeDesktopConfigPath,
  claudeMcpAddJson,
  codexConfigPath,
  commandExists,
  cursorMcpPath,
  mergeCodexToml,
  mergeMcpJson,
  repoRoot,
  restartHint,
  serverJsPath,
  type ConnectTarget,
} from "./connectLib.ts";

const TARGETS: ConnectTarget[] = ["cursor", "claude", "codex"];

function usage(): never {
  console.error(`Usage: npm run connect -- <${TARGETS.join("|")}>`);
  console.error("");
  console.error("Examples:");
  console.error("  npm run connect -- cursor");
  console.error("  npm run connect -- claude");
  console.error("  npm run connect -- codex");
  process.exit(1);
}

function parseTarget(argv: string[]): ConnectTarget {
  const raw = (argv[2] ?? "").trim().toLowerCase();
  if (raw === "openai") return "codex";
  if ((TARGETS as string[]).includes(raw)) return raw as ConnectTarget;
  usage();
}

function ensureDepsAndBuild(root: string): void {
  console.log("==> npm install");
  execSync("npm install", { cwd: root, stdio: "inherit" });
  const js = serverJsPath(root);
  if (!fs.existsSync(js)) {
    console.log("==> npm run build");
    execSync("npm run build", { cwd: root, stdio: "inherit" });
  } else {
    console.log("==> npm run build (refresh dist)");
    execSync("npm run build", { cwd: root, stdio: "inherit" });
  }
}

function runCli(
  bin: string,
  args: string[],
  opts?: { ignoreError?: boolean },
): boolean {
  const res = spawnSync(bin, args, { stdio: "inherit", env: process.env });
  if (res.error) {
    if (!opts?.ignoreError) {
      console.error(`ERROR: failed to run ${bin}: ${res.error.message}`);
    }
    return false;
  }
  if (res.status !== 0 && !opts?.ignoreError) return false;
  return res.status === 0;
}

function connectCursor(root: string): void {
  const cfg = buildMcpServerConfig(root, "cursor");
  const result = mergeMcpJson(cursorMcpPath(), SERVER_NAME, cfg);
  console.log(`✓ Cursor MCP merged → ${result.filePath}`);
  if (result.backup) console.log(`  backup: ${result.backup}`);
}

function connectClaude(root: string): void {
  const js = serverJsPath(root);

  if (commandExists("claude")) {
    console.log("==> claude mcp (user scope, stdio)");
    runCli("claude", ["mcp", "remove", SERVER_NAME], { ignoreError: true });

    const json = claudeMcpAddJson(root, "claude");
    const viaJson = runCli("claude", [
      "mcp",
      "add-json",
      SERVER_NAME,
      json,
      "--scope",
      "user",
    ]);

    if (!viaJson) {
      console.log("==> claude mcp add-json failed — trying claude mcp add …");
      const viaAdd = runCli("claude", [
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "stdio",
        SERVER_NAME,
        "-e",
        "COMPASS_MCP_HOST=claude",
        "--",
        "node",
        js,
      ]);
      if (!viaAdd) {
        console.log("==> claude CLI failed — falling back to Claude Desktop config merge");
        connectClaudeDesktop(root);
        return;
      }
    }

    console.log("✓ Claude Code MCP registered via claude CLI (scope: user)");
    return;
  }

  console.log("==> claude CLI not found — merging Claude Desktop config");
  connectClaudeDesktop(root);
}

function connectClaudeDesktop(root: string): void {
  const cfg = buildMcpServerConfig(root, "claude");
  const filePath = claudeDesktopConfigPath();
  const result = mergeMcpJson(filePath, SERVER_NAME, cfg);
  console.log(`✓ Claude Desktop MCP merged → ${result.filePath}`);
  if (result.backup) console.log(`  backup: ${result.backup}`);
}

function connectCodex(root: string): void {
  const js = serverJsPath(root);

  if (commandExists("codex")) {
    console.log("==> codex mcp (stdio)");
    runCli("codex", ["mcp", "remove", SERVER_NAME], { ignoreError: true });

    const viaAdd = runCli("codex", [
      "mcp",
      "add",
      SERVER_NAME,
      "--env",
      "COMPASS_MCP_HOST=openai",
      "--",
      "node",
      js,
    ]);

    if (viaAdd) {
      console.log("✓ Codex MCP registered via codex CLI");
      return;
    }

    console.log("==> codex CLI add failed — falling back to ~/.codex/config.toml merge");
  } else {
    console.log("==> codex CLI not found — merging ~/.codex/config.toml");
  }

  const result = mergeCodexToml(codexConfigPath(), root, "codex");
  console.log(`✓ Codex MCP merged → ${result.filePath}`);
  if (result.backup) console.log(`  backup: ${result.backup}`);
}

function main(): void {
  const target = parseTarget(process.argv);
  const root = repoRoot();
  const version = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { version?: string };

  console.log(`==> Compass MCP connect v${version.version ?? "?"} → ${target}`);
  console.log(`    repo: ${root}`);
  console.log("");

  ensureDepsAndBuild(root);

  switch (target) {
    case "cursor":
      connectCursor(root);
      break;
    case "claude":
      connectClaude(root);
      break;
    case "codex":
      connectCodex(root);
      break;
  }

  console.log("");
  console.log("Next:");
  for (const line of restartHint(target, "ko")) {
    console.log(`  • ${line}`);
  }
  console.log(`  • Verify: ask agent to call start_session or recommend_model`);
  console.log("");
}

main();
