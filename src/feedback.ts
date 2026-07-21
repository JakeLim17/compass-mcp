/**
 * Local recommendation feedback → light score weights.
 * Default: ~/.cursor/compass-mcp/feedback.jsonl
 * Never log secrets.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CURSOR_TASK_SLUG,
  resolveModelId,
  type ModelId,
} from "./recommend.js";
import { ensureDataDir, feedbackFilePath } from "./paths.js";

export type FeedbackVote = "good" | "bad";

export interface FeedbackEntry {
  ts: string;
  vote: FeedbackVote;
  primary?: string;
  alternative?: string;
  recommendation_id?: string;
  note?: string;
}

export interface FeedbackInput {
  vote: FeedbackVote;
  primary?: string;
  alternative?: string;
  /** Or [primary, alternative?] */
  models?: string[];
  recommendation_id?: string;
  note?: string;
}

const MAX_NOTE = 200;
/** Cap absolute weight so feedback never overrides strong signals */
const MAX_ABS_WEIGHT = 12;
const GOOD_DELTA = 2;
const BAD_DELTA = -2;

function sanitizeNote(note?: string): string | undefined {
  if (!note?.trim()) return undefined;
  let s = note.trim().slice(0, MAX_NOTE);
  s = s.replace(
    /(api[_-]?key|secret|password|token|Bearer)\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  return s;
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function logFeedback(
  input: FeedbackInput,
  opts?: { path?: string },
): { ok: true; entry: FeedbackEntry; path: string } {
  const filePath = opts?.path ?? feedbackFilePath();
  ensureDataDir();
  let primary = input.primary?.trim();
  let alternative = input.alternative?.trim();
  if (input.models?.length) {
    primary = primary ?? input.models[0]?.trim();
    alternative = alternative ?? input.models[1]?.trim();
  }
  const entry: FeedbackEntry = {
    ts: new Date().toISOString(),
    vote: input.vote,
    ...(primary ? { primary } : {}),
    ...(alternative ? { alternative } : {}),
    ...(input.recommendation_id?.trim()
      ? { recommendation_id: input.recommendation_id.trim().slice(0, 64) }
      : {}),
    ...(sanitizeNote(input.note) ? { note: sanitizeNote(input.note) } : {}),
  };
  ensureDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return { ok: true, entry, path: filePath };
}

function parseLines(filePath: string): FeedbackEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const out: FeedbackEntry[] = [];
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as FeedbackEntry;
      if (obj?.vote === "good" || obj?.vote === "bad") out.push(obj);
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Light weights from recent feedback (last N lines).
 * good on primary → +2; bad on primary → -2; capped.
 */
export function feedbackWeights(opts?: {
  path?: string;
  max_lines?: number;
}): Partial<Record<ModelId, number>> {
  const filePath = opts?.path ?? feedbackFilePath();
  const maxLines = Math.max(10, Math.min(500, opts?.max_lines ?? 80));
  const lines = parseLines(filePath).slice(-maxLines);
  const weights: Partial<Record<ModelId, number>> = {};

  for (const e of lines) {
    const primary = resolveModelId(e.primary);
    if (!primary) continue;
    const delta = e.vote === "good" ? GOOD_DELTA : BAD_DELTA;
    weights[primary] = (weights[primary] ?? 0) + delta;
  }

  for (const k of Object.keys(weights) as ModelId[]) {
    const v = weights[k] ?? 0;
    weights[k] = Math.max(-MAX_ABS_WEIGHT, Math.min(MAX_ABS_WEIGHT, v));
  }
  return weights;
}

/** Alias used by server.ts / recommend wiring */
export function getFeedbackAdjustments(opts?: {
  path?: string;
  max_lines?: number;
}): Partial<Record<ModelId, number>> {
  return feedbackWeights(opts);
}

/** Resolve display/slug for logging convenience */
export function normalizeFeedbackModel(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const id = resolveModelId(raw);
  if (id) return id;
  return raw.trim();
}

export function feedbackSlugHint(model: ModelId): string {
  return CURSOR_TASK_SLUG[model];
}
