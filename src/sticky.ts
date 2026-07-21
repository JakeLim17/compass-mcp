/**
 * Sticky adopted model — SSOT for “keep using this model” across turns.
 * Default: ~/.cursor/compass-mcp/sticky.json
 */
import fs from "node:fs";
import path from "node:path";
import { ensureDataDir, stickyFilePath } from "./paths.js";

export interface StickyState {
  adopted_model: string;
  host?: string;
  updated_at: string;
  context_hint?: string;
}

export interface SetStickyInput {
  adopted_model: string;
  host?: string;
  context_hint?: string;
}

export function getSticky(opts?: {
  path?: string;
}): { ok: true; sticky: StickyState | null; path: string } {
  const filePath = opts?.path ?? stickyFilePath();
  if (!fs.existsSync(filePath)) {
    return { ok: true, sticky: null, path: filePath };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const obj = JSON.parse(raw) as StickyState;
    if (!obj?.adopted_model || !obj?.updated_at) {
      return { ok: true, sticky: null, path: filePath };
    }
    return { ok: true, sticky: obj, path: filePath };
  } catch {
    return { ok: true, sticky: null, path: filePath };
  }
}

export function setSticky(
  input: SetStickyInput,
  opts?: { path?: string },
): { ok: true; sticky: StickyState; path: string } {
  const filePath = opts?.path ?? stickyFilePath();
  ensureDataDir();
  const sticky: StickyState = {
    adopted_model: input.adopted_model.trim(),
    updated_at: new Date().toISOString(),
    ...(input.host?.trim() ? { host: input.host.trim() } : {}),
    ...(input.context_hint?.trim()
      ? { context_hint: input.context_hint.trim().slice(0, 200) }
      : {}),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(sticky, null, 2)}\n`, "utf8");
  return { ok: true, sticky, path: filePath };
}

export function clearSticky(opts?: {
  path?: string;
}): { ok: true; cleared: boolean; path: string } {
  const filePath = opts?.path ?? stickyFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { ok: true, cleared: true, path: filePath };
  }
  return { ok: true, cleared: false, path: filePath };
}
