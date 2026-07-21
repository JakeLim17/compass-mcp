/**
 * Project-level overrides: walk up from cwd for `.compass-mcp.json`.
 * Soft prefs only — scoring SSOT remains recommend_model.
 */
import fs from "node:fs";
import path from "node:path";
import type { ModelTier } from "./recommend.js";

export const PROJECT_CONFIG_FILENAME = ".compass-mcp.json";

/** prefer_cheaper aliases: prefer_cheap · cheap · quality aliases: prefer_quality */
export type CostBias =
  | "prefer_cheaper"
  | "prefer_cheap"
  | "cheap"
  | "balanced"
  | "quality"
  | "prefer_quality";

export interface AlertThresholds {
  /** High-tier (Codex) uses today before alert. Default 3. */
  high_tier_today?: number;
  /** Mid+high (Fable/Grok/Codex) uses today before soft alert. Default 8. */
  heavy_today?: number;
}

export interface ProjectConfig {
  preferred_host?: string;
  /** Soft preference when scoring is otherwise flat */
  default_tier?: ModelTier;
  /** Display names or slugs to never pick as primary */
  blocked_models?: string[];
  cost_bias?: CostBias;
  /** Preferred key in JSON; also accept alert_thresholds */
  usage_alert_thresholds?: AlertThresholds;
  alert_thresholds?: AlertThresholds;
}

export interface LoadProjectConfigResult {
  found: boolean;
  path: string | null;
  config: ProjectConfig;
  cwd: string;
}

export const PROJECT_CONFIG_SCHEMA_DOC = {
  preferred_host: "cursor | claude | openai | generic (optional)",
  default_tier: "low | mid | high — soft score nudge",
  blocked_models: [
    "Composer 2.5 | Claude Sonnet | Claude Opus | Fable 5 | Grok 5.x | GPT-5 Codex | slug",
  ],
  cost_bias:
    "prefer_cheaper | balanced | quality (aliases: prefer_cheap, cheap, prefer_quality)",
  usage_alert_thresholds: {
    high_tier_today: 3,
    heavy_today: 8,
  },
  example: {
    preferred_host: "cursor",
    default_tier: "low",
    blocked_models: [],
    cost_bias: "prefer_cheaper",
    usage_alert_thresholds: { high_tier_today: 3, heavy_today: 8 },
  },
};

const VALID_TIERS = new Set<ModelTier>(["low", "mid", "high"]);
const VALID_BIAS = new Set<CostBias>([
  "prefer_cheaper",
  "prefer_cheap",
  "cheap",
  "balanced",
  "quality",
  "prefer_quality",
]);

function sanitizeThresholds(raw: unknown): AlertThresholds | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const at: AlertThresholds = {};
  if (typeof t.high_tier_today === "number" && t.high_tier_today >= 1) {
    at.high_tier_today = Math.min(100, Math.floor(t.high_tier_today));
  }
  if (typeof t.heavy_today === "number" && t.heavy_today >= 1) {
    at.heavy_today = Math.min(200, Math.floor(t.heavy_today));
  }
  return Object.keys(at).length ? at : undefined;
}

function sanitize(raw: unknown): ProjectConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ProjectConfig = {};

  if (typeof o.preferred_host === "string" && o.preferred_host.trim()) {
    out.preferred_host = o.preferred_host.trim();
  }
  if (
    typeof o.default_tier === "string" &&
    VALID_TIERS.has(o.default_tier as ModelTier)
  ) {
    out.default_tier = o.default_tier as ModelTier;
  }
  if (Array.isArray(o.blocked_models)) {
    out.blocked_models = o.blocked_models
      .filter((x): x is string => typeof x === "string" && !!x.trim())
      .map((x) => x.trim())
      .slice(0, 16);
  }
  if (
    typeof o.cost_bias === "string" &&
    VALID_BIAS.has(o.cost_bias as CostBias)
  ) {
    out.cost_bias = o.cost_bias as CostBias;
  }
  const thresholds =
    sanitizeThresholds(o.usage_alert_thresholds) ??
    sanitizeThresholds(o.alert_thresholds);
  if (thresholds) {
    out.usage_alert_thresholds = thresholds;
    out.alert_thresholds = thresholds;
  }
  return out;
}

/** Walk from startDir up to filesystem root looking for `.compass-mcp.json`. */
export function findProjectConfigFile(
  startDir?: string,
): { path: string; config: ProjectConfig } | null {
  let dir = path.resolve(startDir ?? process.cwd());
  const { root } = path.parse(dir);
  for (;;) {
    const candidate = path.join(dir, PROJECT_CONFIG_FILENAME);
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        return { path: candidate, config: sanitize(raw) };
      } catch {
        return { path: candidate, config: {} };
      }
    }
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Primary loader used by MCP tools */
export function loadProjectConfig(opts?: {
  startDir?: string;
  cwd?: string;
}): LoadProjectConfigResult {
  const cwd = path.resolve(opts?.startDir ?? opts?.cwd ?? process.cwd());
  const found = findProjectConfigFile(cwd);
  return {
    found: !!found,
    path: found?.path ?? null,
    config: found?.config ?? {},
    cwd,
  };
}

/** Alias */
export function getProjectConfig(opts?: {
  cwd?: string;
}): LoadProjectConfigResult {
  return loadProjectConfig({ cwd: opts?.cwd });
}
