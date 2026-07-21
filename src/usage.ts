/**
 * Local JSONL usage log for model recommendations / subagent launches.
 * Default path: ~/.cursor/compass-mcp/usage.jsonl
 * Override: COMPASS_MCP_USAGE_PATH (legacy: MODEL_ROUTER_USAGE_PATH).
 * Never log secrets — only model, optional task_tag, short note.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CURSOR_TASK_SLUG,
  MODEL_TIER,
  resolveModelId,
  type ModelId,
  type ModelTier,
} from "./recommend.js";
import type { AlertThresholds } from "./projectConfig.js";
import { usageFilePath } from "./paths.js";

export interface UsageEntry {
  ts: string; // ISO
  model: string; // display name when resolvable, else raw slug
  slug?: string;
  task_tag?: string;
  note?: string;
}

export interface LogUsageInput {
  model: string;
  task_tag?: string;
  note?: string;
}

export interface UsageAlert {
  level: "info" | "warn";
  code: string;
  en: string;
  ko: string;
}

export type UsagePeriod = "day" | "week";

export interface UsageReportText {
  en: string;
  ko: string;
}

export interface UsageSummary {
  path: string;
  /** Focus window for `report` and `by_model` / `by_tier` */
  period: UsagePeriod;
  since_days: number;
  today: Record<string, number>;
  week: Record<string, number>;
  /** Same as today (day) or week (week) — convenient alias */
  by_model: Record<string, number>;
  total_today: number;
  total_week: number;
  total_period: number;
  /** Today counts by coarse tier */
  today_by_tier: Record<ModelTier, number>;
  week_by_tier: Record<ModelTier, number>;
  by_tier: Record<ModelTier, number>;
  alerts: UsageAlert[];
  thresholds: Required<AlertThresholds>;
  /** Friendly weekly/daily digest (EN + KO) */
  report: UsageReportText;
}

const MAX_NOTE = 200;
const MAX_TAG = 64;

const DEFAULT_THRESHOLDS: Required<AlertThresholds> = {
  high_tier_today: 3,
  heavy_today: 8,
};

/** Override for tests / custom locations */
export function usageLogPath(override?: string): string {
  if (override) return override;
  return usageFilePath();
}

function sanitizeNote(note?: string): string | undefined {
  if (!note?.trim()) return undefined;
  let s = note.trim().slice(0, MAX_NOTE);
  s = s.replace(
    /(api[_-]?key|secret|password|token|Bearer)\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  return s;
}

function sanitizeTag(tag?: string): string | undefined {
  if (!tag?.trim()) return undefined;
  return tag.trim().slice(0, MAX_TAG);
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** Append one JSONL line. Returns the written entry + path. */
export function logModelUsage(
  input: LogUsageInput,
  opts?: { path?: string },
): { ok: true; entry: UsageEntry; path: string } {
  const filePath = usageLogPath(opts?.path);
  const raw = input.model.trim();
  const resolved = resolveModelId(raw);
  const slug = resolved
    ? CURSOR_TASK_SLUG[resolved as ModelId]
    : raw || undefined;
  const entry: UsageEntry = {
    ts: new Date().toISOString(),
    model: resolved ?? raw,
    ...(slug ? { slug } : {}),
    ...(sanitizeTag(input.task_tag)
      ? { task_tag: sanitizeTag(input.task_tag) }
      : {}),
    ...(sanitizeNote(input.note) ? { note: sanitizeNote(input.note) } : {}),
  };

  ensureDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return { ok: true, entry, path: filePath };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLines(filePath: string): UsageEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const out: UsageEntry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as UsageEntry;
      if (obj?.model && obj?.ts) out.push(obj);
    } catch {
      // skip corrupt lines
    }
  }
  return out;
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function sum(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

function tierOf(modelName: string): ModelTier | null {
  const id = resolveModelId(modelName);
  if (!id) return null;
  return MODEL_TIER[id];
}

function buildAlerts(
  todayByTier: Record<ModelTier, number>,
  thresholds: Required<AlertThresholds>,
): UsageAlert[] {
  const alerts: UsageAlert[] = [];
  const high = todayByTier.high;
  const heavy = todayByTier.mid + todayByTier.high;

  if (high >= thresholds.high_tier_today) {
    alerts.push({
      level: "warn",
      code: "high_tier_today",
      en: `High-tier (Codex) used ${high}× today (threshold ${thresholds.high_tier_today}). Prefer Composer for the next light/bulk jobs.`,
      ko: `오늘 고비용(Codex) ${high}회 (기준 ${thresholds.high_tier_today}). 다음 가벼운·대량 작업은 Composer 위주로.`,
    });
  }
  if (heavy >= thresholds.heavy_today) {
    alerts.push({
      level: high >= thresholds.high_tier_today ? "warn" : "info",
      code: "heavy_today",
      en: `Mid/high models used ${heavy}× today (threshold ${thresholds.heavy_today}). Bias toward cheaper primary unless stuck.`,
      ko: `오늘 중·고가 모델 ${heavy}회 (기준 ${thresholds.heavy_today}). 막히지 않았으면 저가 primary 우선.`,
    });
  }
  return alerts;
}

function emptyTier(): Record<ModelTier, number> {
  return { low: 0, mid: 0, high: 0 };
}

function formatCounts(map: Record<string, number>): string {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "(none)";
  return entries.map(([k, v]) => `${k}×${v}`).join(", ");
}

function formatTiers(tiers: Record<ModelTier, number>): string {
  return `low=${tiers.low} mid=${tiers.mid} high=${tiers.high}`;
}

function buildReport(input: {
  period: UsagePeriod;
  by_model: Record<string, number>;
  by_tier: Record<ModelTier, number>;
  total: number;
  alerts: UsageAlert[];
}): UsageReportText {
  const labelEn = input.period === "day" ? "Today" : "This week";
  const labelKo = input.period === "day" ? "오늘" : "이번 주";
  const models = formatCounts(input.by_model);
  const tiers = formatTiers(input.by_tier);
  const alertEn =
    input.alerts.length === 0
      ? "No usage alerts."
      : input.alerts.map((a) => a.en).join(" ");
  const alertKo =
    input.alerts.length === 0
      ? "사용량 알림 없음."
      : input.alerts.map((a) => a.ko).join(" ");

  return {
    en: `${labelEn}: ${input.total} call(s). By model: ${models}. By tier: ${tiers}. ${alertEn}`,
    ko: `${labelKo}: ${input.total}회. 모델별: ${models}. 티어별: ${tiers}. ${alertKo}`,
  };
}

/**
 * Counts by model for today and last 7 calendar days (week).
 * `period: day|week` selects which window drives `report` / `by_model` / `by_tier`.
 * Includes usage alerts when high-tier / heavy usage crosses thresholds.
 */
export function getUsageSummary(opts?: {
  /** Focus for report — day (default) or week */
  period?: UsagePeriod;
  /** Legacy: when set without period, maps 1→day else week; also fills since_days */
  since_days?: number;
  path?: string;
  now?: Date;
  alert_thresholds?: AlertThresholds;
}): UsageSummary {
  const period: UsagePeriod =
    opts?.period ??
    (opts?.since_days != null && opts.since_days <= 1 ? "day" : "week");
  const sinceDays =
    opts?.since_days != null
      ? Math.max(1, Math.min(365, opts.since_days))
      : period === "day"
        ? 1
        : 7;
  const filePath = usageLogPath(opts?.path);
  const now = opts?.now ?? new Date();
  const todayStart = startOfLocalDay(now).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const thresholds: Required<AlertThresholds> = {
    high_tier_today:
      opts?.alert_thresholds?.high_tier_today ??
      DEFAULT_THRESHOLDS.high_tier_today,
    heavy_today:
      opts?.alert_thresholds?.heavy_today ?? DEFAULT_THRESHOLDS.heavy_today,
  };

  const today: Record<string, number> = {};
  const week: Record<string, number> = {};
  const today_by_tier = emptyTier();
  const week_by_tier = emptyTier();

  for (const e of parseLines(filePath)) {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    const key = e.model;
    const tier = tierOf(key);
    if (t >= todayStart) {
      bump(today, key);
      if (tier) today_by_tier[tier] += 1;
    }
    if (t >= weekStart) {
      bump(week, key);
      if (tier) week_by_tier[tier] += 1;
    }
  }

  const by_model = period === "day" ? today : week;
  const by_tier = period === "day" ? today_by_tier : week_by_tier;
  const total_today = sum(today);
  const total_week = sum(week);
  const total_period = period === "day" ? total_today : total_week;
  const alerts = buildAlerts(today_by_tier, thresholds);
  const report = buildReport({
    period,
    by_model,
    by_tier,
    total: total_period,
    alerts,
  });

  return {
    path: filePath,
    period,
    since_days: sinceDays,
    today,
    week,
    by_model,
    total_today,
    total_week,
    total_period,
    today_by_tier,
    week_by_tier,
    by_tier,
    alerts,
    thresholds,
    report,
  };
}
