/**
 * Local data dir under ~/.cursor/compass-mcp/
 * Override root: COMPASS_MCP_DATA_DIR
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function compassDataDir(override?: string): string {
  if (override) return override;
  const fromEnv = process.env.COMPASS_MCP_DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(os.homedir(), ".cursor", "compass-mcp");
}

export function ensureDataDir(dir?: string): string {
  const d = compassDataDir(dir);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function stickyFilePath(dataDir?: string): string {
  return path.join(compassDataDir(dataDir), "sticky.json");
}

export function feedbackFilePath(dataDir?: string): string {
  return path.join(compassDataDir(dataDir), "feedback.jsonl");
}

export function usageFilePath(dataDir?: string): string {
  const fromEnv =
    process.env.COMPASS_MCP_USAGE_PATH?.trim() ||
    process.env.MODEL_ROUTER_USAGE_PATH?.trim();
  if (fromEnv) return fromEnv;
  return path.join(compassDataDir(dataDir), "usage.jsonl");
}
