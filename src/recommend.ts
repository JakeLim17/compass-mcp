/**
 * ChronoCode model scoring SSOT.
 * Goal: task-fit model — not “always cheapest”, not vendor-locked.
 * Light patch → Composer · UI/multi-file → Sonnet/Fable · design/plan → Fable/Grok/Opus/Sonnet (compete)
 * · hard CI/bug → Codex. Primary unavailable on host → next in fallback_chain / candidates.
 * Claude family: Composer < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex
 * Only recommend Cursor catalog slugs for host=cursor.
 */
import {
  hostModelId,
  isHostIdAvailable,
  resolveHostId,
  resolveModelIdFromHostId,
} from "./hosts.js";
import type { ProjectConfig } from "./projectConfig.js";
import { createHash, randomBytes } from "node:crypto";

export type ModelId =
  | "Composer 2.5"
  | "Claude Sonnet"
  | "Claude Opus"
  | "Fable 5"
  | "Grok 5.x"
  | "GPT-5 Sol"
  | "GPT-5 Codex";

/** Relative cost/weight — not dollar amounts */
export type CostTier = "low" | "medium" | "medium-high" | "high";

/**
 * Coarse model tier (docs / vibe-coding pick):
 * low = Composer · mid = Sonnet/Opus/Fable/Grok/Sol · high = Codex(Terra)
 */
export type ModelTier = "low" | "mid" | "high";

/** Estimated context/token burn for this task (not $) */
export type TokenRisk = "low" | "medium" | "high";

export type Tag = "ui" | "bug" | "architecture" | "test";

export interface UsageEstimate {
  en: string;
  ko: string;
}

/** Coarse weight for UI — light / medium / heavy (relative only, not $) */
export type CostWeight = "light" | "medium" | "heavy";

/** Relative cost preview — no token/dollar/balance numbers */
export interface CostPreview {
  weight: CostWeight;
  relative: UsageEstimate;
  advice: UsageEstimate;
}

/**
 * Cursor agent-usable Task `model` slugs (SSOT).
 * Never recommend a slug outside this list for host=cursor.
 * kimi is optional (resolve/sticky OK; not default-scored).
 */
export const CURSOR_AGENT_CATALOG = [
  "composer-2.5-fast",
  "claude-sonnet-5-thinking-high",
  "claude-opus-4-8-thinking-high",
  "claude-fable-5-thinking-high",
  "cursor-grok-4.5-high-fast",
  "gpt-5.6-sol-medium",
  "gpt-5.6-terra-medium",
  "kimi-k2.7-code",
] as const;

export type CursorCatalogSlug = (typeof CURSOR_AGENT_CATALOG)[number];

export const CURSOR_CATALOG_SET = new Set<string>(CURSOR_AGENT_CATALOG);

/** Optional: resolve/sticky only — not in default MODELS scoring */
export const CURSOR_OPTIONAL_SLUGS = new Set<string>(["kimi-k2.7-code"]);

/** Claude family ladder (lowest → highest). Composer = Cursor-cheap below Sonnet. */
export const CLAUDE_FAMILY_LADDER: ModelId[] = [
  "Composer 2.5",
  "Claude Sonnet",
  "Claude Opus",
  "Fable 5",
];

/** GPT/Codex family: Sol (cheaper) < Terra/Codex (heavier) */
export const GPT_FAMILY_LADDER: ModelId[] = ["GPT-5 Sol", "GPT-5 Codex"];

export const CLAUDE_LADDER_DOC =
  "Claude: Composer < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex (design/plan competes: Fable/Grok/Opus/Sonnet)";

export const GPT_LADDER_DOC = "Sol < Terra/Codex";

/** Relative cost map */
export const COST_TIER: Record<ModelId, CostTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "medium",
  "Claude Opus": "medium-high",
  "Fable 5": "medium-high",
  "Grok 5.x": "medium-high",
  "GPT-5 Sol": "medium-high",
  "GPT-5 Codex": "high",
};

/** Coarse tier */
export const MODEL_TIER: Record<ModelId, ModelTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "mid",
  "Claude Opus": "mid",
  "Fable 5": "mid",
  "Grok 5.x": "mid",
  "GPT-5 Sol": "mid",
  "GPT-5 Codex": "high",
};

/** Approximate relative burn vs Composer=1× — heuristic, not billing */
const RELATIVE_COST: Record<ModelId, UsageEstimate> = {
  "Composer 2.5": { ko: "Composer ≈1× (기준)", en: "Composer ≈1× (baseline)" },
  "Claude Sonnet": { ko: "Sonnet ≈2×", en: "Sonnet ≈2×" },
  "Claude Opus": { ko: "Opus ≈2–3×", en: "Opus ≈2–3×" },
  "Fable 5": { ko: "Fable ≈2–3×", en: "Fable ≈2–3×" },
  "Grok 5.x": { ko: "Grok ≈2–3× (설계)", en: "Grok ≈2–3× (design)" },
  "GPT-5 Sol": { ko: "Sol ≈2–3×", en: "Sol ≈2–3×" },
  "GPT-5 Codex": { ko: "Codex/Terra ≈4–5× (고비용)", en: "Codex/Terra ≈4–5× (high)" },
};

export function costTierToWeight(tier: CostTier): CostWeight {
  if (tier === "low") return "light";
  if (tier === "high") return "heavy";
  return "medium";
}

const USAGE_ESTIMATE: Record<ModelId, UsageEstimate> = {
  "Composer 2.5": {
    en: "light daily loop — prefer for small patches / bulk mechanical",
    ko: "가벼운 일상 루프 — 작은 수정·대량 기계 작업에 적합",
  },
  "Claude Sonnet": {
    en: "cheaper Claude mid — quality without Fable burn",
    ko: "저가 Claude mid — Fable보다 싸게 품질 유지",
  },
  "Claude Opus": {
    en: "stronger Claude than Sonnet — still below Fable",
    ko: "Sonnet보다 강한 Claude — Fable 아래 한 단",
  },
  "Fable 5": {
    en: "mid-weight multi-file / UI job (Cursor high Claude)",
    ko: "중간 무게 멀티파일·UI 작업 (Cursor 고가 Claude)",
  },
  "Grok 5.x": {
    en: "design/plan contender — broad tradeoffs & creative planning",
    ko: "설계·기획 경쟁 후보 — 넓은 트레이드오프·창의 기획",
  },
  "GPT-5 Sol": {
    en: "cheaper GPT tier — mid reasoning without Terra burn",
    ko: "저가 GPT — Terra/Codex보다 싸게 추론",
  },
  "GPT-5 Codex": {
    en: "Terra/Codex-class — prefer when stuck on CI/hard bugs",
    ko: "Terra/Codex급 — CI·난해한 버그에 막혔을 때",
  },
};

export interface RecommendInput {
  task_description: string;
  tags?: Tag[];
  /** sticky: 현재 채택 모델(표시명 또는 Task slug). 있으면 stick_action 반환 */
  current_model?: string;
  /** MCP host profile: cursor | claude | openai | generic (default env COMPASS_MCP_HOST or cursor) */
  host?: string;
  /** Optional .compass-mcp.json preferences */
  project_config?: ProjectConfig;
  /** Optional light feedback score nudge (capped externally) */
  feedback_adjust?: Partial<Record<ModelId, number>>;
  /**
   * When usage alerts fired (high_tier_today / heavy_today), bias prefer_cheaper.
   * Wired from getUsageSummary in server tools.
   */
  usage_prefer_cheaper?: boolean;
}

/** Cursor Task tool `model` 파라미터용 slug (UI 표시명과 별도) */
export const CURSOR_TASK_SLUG: Record<ModelId, string> = {
  "Composer 2.5": "composer-2.5-fast",
  "Claude Sonnet": "claude-sonnet-5-thinking-high",
  "Claude Opus": "claude-opus-4-8-thinking-high",
  "Fable 5": "claude-fable-5-thinking-high",
  "Grok 5.x": "cursor-grok-4.5-high-fast",
  "GPT-5 Sol": "gpt-5.6-sol-medium",
  "GPT-5 Codex": "gpt-5.6-terra-medium",
};

const SLUG_TO_MODEL: Record<string, ModelId> = Object.fromEntries(
  (Object.entries(CURSOR_TASK_SLUG) as [ModelId, string][]).map(([id, slug]) => [
    slug,
    id,
  ]),
) as Record<string, ModelId>;

export function isCursorCatalogSlug(slug: string): boolean {
  return CURSOR_CATALOG_SET.has(slug);
}

/** Assert slug is in catalog; returns null if not (never invent slugs). */
export function catalogSlugOrNull(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  const s = slug.trim();
  return isCursorCatalogSlug(s) ? s : null;
}

/** 표시명·slug·약칭 → ModelId (모르면 null) */
export function resolveModelId(raw?: string | null): ModelId | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if ((MODELS as string[]).includes(s)) return s as ModelId;
  if (SLUG_TO_MODEL[s]) return SLUG_TO_MODEL[s];
  // optional catalog slug (kimi) — not a scored ModelId
  if (CURSOR_OPTIONAL_SLUGS.has(s)) return null;
  const lower = s.toLowerCase();
  if (lower.includes("composer")) return "Composer 2.5";
  if (lower.includes("sonnet")) return "Claude Sonnet";
  if (lower.includes("opus")) return "Claude Opus";
  if (lower.includes("fable")) return "Fable 5";
  if (lower.includes("grok")) return "Grok 5.x";
  if (lower.includes("terra") || lower.includes("codex")) return "GPT-5 Codex";
  if (lower.includes("sol") || lower === "gpt-5.6-sol-medium") return "GPT-5 Sol";
  if (lower.includes("gpt-5") || lower.includes("gpt5")) return "GPT-5 Codex";
  if (lower.startsWith("role:")) {
    if (lower.includes("light") || lower.includes("cheap")) return "Composer 2.5";
    if (lower.includes("sonnet")) return "Claude Sonnet";
    if (lower.includes("opus")) return "Claude Opus";
    if (lower.includes("mid") || lower.includes("ui")) return "Fable 5";
    if (lower.includes("design")) return "Fable 5";
    if (lower.includes("sol")) return "GPT-5 Sol";
    if (lower.includes("heavy")) return "GPT-5 Codex";
  }
  return null;
}

export interface CheaperFallback {
  name: ModelId;
  slug: string;
  tier: ModelTier;
}

/** Ordered fallback entry — host-mapped id + optional reason */
export interface FallbackCandidate {
  name: ModelId;
  id: string;
  slug: string;
  reason?: string;
}

export interface RecommendResult {
  primary: ModelId;
  alternative: ModelId;
  reason: string;
  scores: Record<ModelId, number>;
  /** Cursor Task 서브에이전트용 model slug (compat — always Cursor map) */
  primary_slug: string;
  alternative_slug: string;
  /** Resolved host profile id */
  host: string;
  /** Host-mapped model id for primary (equals primary_slug when host=cursor) */
  primary_id: string;
  /** Host-mapped model id for alternative */
  alternative_id: string;
  /** Relative cost/weight of primary */
  primary_cost_tier: CostTier;
  /** Relative cost/weight of alternative */
  alternative_cost_tier: CostTier;
  /** Coarse tier: low=Composer mid=Sonnet/Opus/Fable/Grok/Sol high=Codex */
  primary_tier: ModelTier;
  alternative_tier: ModelTier;
  /** Estimated token/context burn for this task */
  token_risk: TokenRisk;
  /**
   * true when token_risk=high, cost_bias cheap, or usage alerts:
   * bulk → Composer; UI quality-cheap → Sonnet; hard bug → Terra + Sol/Sonnet fallback
   */
  prefer_cheaper: boolean;
  /**
   * Always present: step-down on family ladder (or Composer when already cheapest).
   * Agents: when prefer_cheaper, prefer Task model=cheaper_fallback_slug.
   */
  cheaper_fallback: CheaperFallback;
  cheaper_fallback_slug: string;
  /**
   * Ordered host-mapped candidates: primary → alternative → step-down.
   * Agents: if primary_id unavailable on host, use candidates[1].id, then next.
   */
  candidates: FallbackCandidate[];
  /**
   * Slug/id strings parallel to candidates (compat). Same order as candidates.
   */
  fallback_chain: string[];
  /** Short EN+KO hint about when this weight is worth it */
  usage_estimate: UsageEstimate;
  /** Idempotent-ish id for feedback_recommendation */
  recommendation_id: string;
  /** current_model 있을 때: keep = 그대로 / switch = 전환 제안 */
  stick_action?: "keep" | "switch";
  current_resolved?: ModelId | null;
  /** When keep: soft hint to stay quiet (internal) */
  sticky_suggest?: "keep_silent";
  /** Human-facing keep/switch line — no “sticky” word */
  model_persistence?: UsageEstimate;
  /** Task recommendation — distinct from the agent that called this MCP */
  for_task: {
    primary: ModelId;
    primary_id: string;
    cost_tier: CostTier;
  };
  /** One-line KO/EN: recommended model vs caller */
  clarity: UsageEstimate;
  /** Relative weight/cost/advice — visible savings hint (no $/tokens) */
  cost_preview: CostPreview;
  /** UI auto-switch off + runner may differ from recommendation */
  honest_limit: UsageEstimate;
}

const MODELS: ModelId[] = [
  "Composer 2.5",
  "Claude Sonnet",
  "Claude Opus",
  "Fable 5",
  "Grok 5.x",
  "GPT-5 Sol",
  "GPT-5 Codex",
];

/** 기본 비중 반영 베이스 점수 */
const BASE: Record<ModelId, number> = {
  "Composer 2.5": 40,
  "Claude Sonnet": 12,
  "Claude Opus": 6,
  "Fable 5": 15,
  "Grok 5.x": 8,
  "GPT-5 Sol": 4,
  "GPT-5 Codex": 5,
};

const TAG_BOOST: Record<Tag, Partial<Record<ModelId, number>>> = {
  ui: { "Fable 5": 35, "Claude Sonnet": 8, "Composer 2.5": 5 },
  // Codex(Terra) must beat Composer BASE(40); Sol is next if Codex blocked
  bug: {
    "GPT-5 Codex": 50,
    "GPT-5 Sol": 45,
    "Claude Sonnet": 8,
    "Composer 2.5": 5,
  },
  architecture: {
    "Fable 5": 38,
    "Grok 5.x": 32,
    "Claude Opus": 28,
    "Claude Sonnet": 14,
  },
  test: {
    "GPT-5 Codex": 50,
    "GPT-5 Sol": 45,
    "Claude Sonnet": 8,
    "Composer 2.5": 5,
  },
};

const KEYWORD_RULES: Array<{
  re: RegExp;
  boost: Partial<Record<ModelId, number>>;
}> = [
  {
    re: /ui|ux|디자인|화면|레이아웃|프론트|css|스타일|컴포넌트|랜딩|히어로/i,
    boost: { "Fable 5": 25, "Claude Sonnet": 6, "Composer 2.5": 5 },
  },
  {
    re: /리팩터|리팩토링|멀티\s*파일|넓은|대규모|코드베이스|아키텍처\s*이해/i,
    boost: { "Fable 5": 30, "Claude Sonnet": 8, "Composer 2.5": 5 },
  },
  {
    re: /설계|구조|아키텍처|기술\s*선택|어떻게\s*짤|기획|계획|트레이드.?오프|의사결정/i,
    boost: {
      "Fable 5": 32,
      "Grok 5.x": 30,
      "Claude Opus": 22,
      "Claude Sonnet": 10,
    },
  },
  {
    re: /간단\s*계획|짧은\s*기획|가벼운\s*설계|light\s*plan|quick\s*plan|sketch/i,
    boost: { "Claude Sonnet": 28, "Composer 2.5": 12, "Fable 5": -8, "Grok 5.x": -6 },
  },
  {
    re: /ui\s*설계|화면\s*설계|ux\s*설계|와이어|wireframe|컴포넌트\s*설계/i,
    boost: { "Fable 5": 35, "Claude Sonnet": 22, "Grok 5.x": 18 },
  },
  {
    re: /ci\s*실패|테스트\s*설계|재현|난해|플레?이키|디버그|버그|회귀|타입\s*에러/i,
    boost: {
      "GPT-5 Codex": 35,
      "GPT-5 Sol": 28,
      "Claude Sonnet": 8,
      "Composer 2.5": 10,
    },
  },
  {
    re: /i18n|문구|카피|한\s*줄|타이포|주석|lint|작은|퀵|핫픽스|문구\s*수정/i,
    boost: { "Composer 2.5": 30 },
  },
  {
    re: /기능\s*추가|버그픽스|패치|루프|일상|가성비/i,
    boost: { "Composer 2.5": 20, "Claude Sonnet": 5 },
  },
];

function addScores(
  scores: Record<ModelId, number>,
  boost: Partial<Record<ModelId, number>>,
) {
  for (const [k, v] of Object.entries(boost) as [ModelId, number][]) {
    scores[k] += v;
  }
}

function topTwo(scores: Record<ModelId, number>): [ModelId, ModelId] {
  const ranked = [...MODELS].sort((a, b) => scores[b] - scores[a]);
  return [ranked[0], ranked[1]];
}

/** Strong signals that this job will burn a lot of context/tokens */
const HIGH_TOKEN_RE =
  /many\s*files|수백\s*(개|파일)|수천|전체\s*(코드|파일|리팩터|마이그레이션|코드베이스)|대량|리팩터\s*전부|전부\s*리팩터|refactor\s*(whole|all|entire|everything)|bulk|migrate\s*(all|entire|whole)|긴\s*로그|long\s*(log|logs|output)|generate\s*(lots|all|many|bulk)|코드\s*대량|일괄\s*(변경|수정|생성|리네임)|모든\s*파일|whole\s*codebase|entire\s*codebase|대규모\s*(리팩터|마이그레이션|변경)|코드베이스\s*전체/i;

/** Small/cheap jobs — quality-first stays on Composer naturally */
const LOW_TOKEN_RE =
  /한\s*줄|one[- ]?line|i18n|타이포|typo|문구\s*수정|작은\s*(수정|패치|카피|문구)|주석\s*만|lint\s*만|퀵\s*(픽스|패치)|hot\s*fix|카피\s*한\s*줄/i;

/** Hard debug / CI — keep Terra/Codex even when tokens are high */
const HARD_BUG_RE =
  /ci\s*실패|테스트\s*설계|재현|난해|플레?이키|디버그|버그|회귀|타입\s*에러|hard\s*bug|root\s*cause|stuck\s*on/i;

/** Bulk / mechanical — prefer cheaper primary when token_risk=high */
const BULK_MECHANICAL_RE =
  /리팩터|리팩토링|refactor|migrate|마이그레이션|bulk|대량|일괄|generate|생성|rename|리네임|전체|many\s*files|코드베이스|대규모/i;

const UI_TASK_RE =
  /ui|ux|디자인|화면|레이아웃|프론트|css|스타일|컴포넌트|랜딩|히어로/i;

/** Implementation / coding phase — design→build handoff */
const IMPLEMENTATION_RE =
  /구현|코딩|만들자|구현해보자|코드\s*작|개발해|implement|build\s*it|write\s*code|coding|만들어\s*줘|코딩해/i;

export function isImplementationTask(text: string): boolean {
  return IMPLEMENTATION_RE.test(text ?? "");
}

/** Models typically used for design/planning (hand off when task shifts to build) */
export const DESIGN_ROLE_MODELS: ModelId[] = [
  "Fable 5",
  "Grok 5.x",
  "Claude Opus",
  "Claude Sonnet",
];

export function isDesignRoleModel(model: ModelId): boolean {
  return (DESIGN_ROLE_MODELS as string[]).includes(model);
}

function buildModelPersistenceNote(
  stick_action: "keep" | "switch",
  primary: ModelId,
): UsageEstimate {
  if (stick_action === "keep") {
    return {
      ko: "같은 작업이면 모델 유지",
      en: "Keep the same model for the same kind of work",
    };
  }
  return {
    ko: `작업 종류가 바뀌어 ${primary}로 바꾸길 권함`,
    en: `Task type changed — recommend switching to ${primary}`,
  };
}

/** Estimate token/context burn from description (+ tags as weak hints) */
export function estimateTokenRisk(
  text: string,
  tags: Tag[] = [],
): TokenRisk {
  const t = text ?? "";
  if (HIGH_TOKEN_RE.test(t)) return "high";
  if (LOW_TOKEN_RE.test(t)) return "low";
  void tags;
  return "medium";
}

function isHardBugTask(text: string, tags: Tag[]): boolean {
  return (
    tags.includes("bug") ||
    tags.includes("test") ||
    HARD_BUG_RE.test(text)
  );
}

function isBulkMechanical(text: string): boolean {
  return BULK_MECHANICAL_RE.test(text);
}

function isUiTask(text: string, tags: Tag[]): boolean {
  return tags.includes("ui") || UI_TASK_RE.test(text);
}

function isCheapExplicit(cfg?: ProjectConfig): boolean {
  const b = cfg?.cost_bias;
  return (
    b === "prefer_cheaper" ||
    b === "prefer_cheap" ||
    b === "cheap"
  );
}

function isQualityBias(cfg?: ProjectConfig): boolean {
  const b = cfg?.cost_bias;
  return b === "quality" || b === "prefer_quality";
}

/**
 * Product default: save tokens.
 * Unset / cheap / balanced → cheap. Only quality/premium opts out.
 */
function effectiveSaveBias(
  cfg?: ProjectConfig,
  budget?: "save" | "neutral" | "premium",
): boolean {
  if (budget === "premium" || isQualityBias(cfg)) return false;
  if (budget === "save" || isCheapExplicit(cfg)) return true;
  // unset or balanced → still save by default
  return true;
}

const PREMIUM_BUDGET_RE =
  /최고\s*(품질|성능)|비싸도\s*됨|비싸도\s*괜찮|premium|max\s*quality|토큰\s*상관없|quality\s*first|돈\s*많|성능\s*최우선|fable\s*써|opus\s*써/i;

const SAVE_BUDGET_RE =
  /싸게|토큰\s*아껴|토큰\s*절약|저렴|cheap|save\s*tokens?|가성비|절약|저비용|composer\s*로/i;

const LARGE_UI_RE =
  /전면\s*(리)?디자인|전체\s*ui|ui\s*전면|large\s*ui|redesign\s*(entire|whole|all)|멀티\s*파일\s*ui|넓은\s*(화면|레이아웃)|히어로\s*.*랜딩|랜딩\s*.*히어로/i;

const TINY_SCOPE_RE =
  /한\s*줄|one[- ]?line|i18n|타이포|typo|문구\s*만|주석\s*만|lint\s*만|퀵\s*(픽스|패치)|hot\s*fix|카피\s*한\s*줄|작은\s*(수정|패치)/i;

const BROAD_SCOPE_RE =
  /전체\s*(코드|파일|리팩터|마이그레이션)|many\s*files|대량|일괄|코드베이스|대규모|broad|across\s*(the\s*)?(codebase|repo)/i;

export type CommandBudget = "save" | "neutral" | "premium";
export type CommandScope = "tiny" | "local" | "broad" | "huge";

/** Parse task_description intent — not keyword spam alone */
export interface CommandSignals {
  char_len: number;
  scope: CommandScope;
  budget: CommandBudget;
  hard_bug: boolean;
  large_ui: boolean;
  architecture: boolean;
  ui: boolean;
  /** Coding/build phase detected in the task sentence */
  implementation: boolean;
  /** One-line WHY for reason field */
  why: string;
}

export function analyzeCommand(text: string, tags: Tag[] = []): CommandSignals {
  const t = text ?? "";
  const char_len = t.trim().length;
  const hard_bug = isHardBugTask(t, tags);
  const ui = isUiTask(t, tags);
  const architecture =
    tags.includes("architecture") ||
    /설계|구조|아키텍처|트레이드.?오프|기술\s*선택|의사결정|기획|계획/i.test(t);
  const implementation = isImplementationTask(t);
  const large_ui = ui && (LARGE_UI_RE.test(t) || (BROAD_SCOPE_RE.test(t) && ui));

  let budget: CommandBudget = "neutral";
  if (PREMIUM_BUDGET_RE.test(t)) budget = "premium";
  else if (SAVE_BUDGET_RE.test(t)) budget = "save";

  let scope: CommandScope = "local";
  if (TINY_SCOPE_RE.test(t)) scope = "tiny";
  else if (/수천|수백\s*파일|entire\s*codebase|whole\s*codebase/i.test(t))
    scope = "huge";
  else if (BROAD_SCOPE_RE.test(t) || char_len > 160) scope = "broad";
  else if (char_len < 18 && !ui && !hard_bug && !architecture) scope = "tiny";

  let why: string;
  if (budget === "premium") {
    why = "명령에 최고품질/프리미엄 명시 → 절약 해제";
  } else if (hard_bug) {
    why = "난해 버그·CI·재현 → Terra/Codex급 필요";
  } else if (architecture && !ui && !implementation) {
    why = "설계·기획·트레이드오프 → Fable/Grok/Opus/Sonnet 경쟁";
  } else if (architecture && implementation) {
    why = "설계+구현 혼합 → 구현 신호 우선(Composer/UI면 Fable)";
  } else if (large_ui) {
    why = "넓은 UI 리디자인 → Fable 에스컬레이션";
  } else if (scope === "tiny" || TINY_SCOPE_RE.test(t)) {
    why = "한 줄·작은 패치 → Composer(최소)";
  } else if (ui) {
    why = "일반 UI → Sonnet(절약 기본, Fable 보류)";
  } else if (scope === "broad" || scope === "huge") {
    why = "넓은/대량 범위 → 기계 작업은 Composer, 설계는 Fable";
  } else {
    why = "과한 고가 모델 없이 작업에 맞는 선택";
  }

  return {
    char_len,
    scope,
    budget,
    hard_bug,
    large_ui,
    architecture,
    ui,
    implementation,
    why,
  };
}

function isCheapBias(cfg?: ProjectConfig): boolean {
  return effectiveSaveBias(cfg);
}

/** Merge blocked_models + unavailable_models into a Set of ModelId */
export function unavailableSet(cfg?: ProjectConfig): Set<ModelId> {
  const raw = [
    ...(cfg?.blocked_models ?? []),
    ...(cfg?.unavailable_models ?? []),
  ];
  return new Set(
    raw.map((m) => resolveModelId(m)).filter((m): m is ModelId => !!m),
  );
}

/**
 * Step-down ModelIds after primary (family first, then cheap cross-family).
 * Skips unavailable; never invents non-catalog slugs.
 */
export function buildFallbackModels(
  primary: ModelId,
  opts?: { hardBug?: boolean; unavailable?: Set<ModelId> },
): ModelId[] {
  const blocked = opts?.unavailable ?? new Set<ModelId>();
  let candidates: ModelId[];

  if (primary === "GPT-5 Codex" || (opts?.hardBug && primary === "GPT-5 Sol")) {
    // GPT ladder then Claude cheap
    candidates = ["GPT-5 Sol", "Claude Sonnet", "Composer 2.5"];
  } else if (primary === "GPT-5 Sol") {
    candidates = ["Claude Sonnet", "Composer 2.5"];
  } else if (primary === "Fable 5") {
    // Claude ladder step-down; prefer_cheaper paths often jump to Sonnet via scoring
    candidates = ["Claude Opus", "Claude Sonnet", "Composer 2.5"];
  } else if (primary === "Claude Opus") {
    candidates = ["Claude Sonnet", "Composer 2.5"];
  } else if (primary === "Claude Sonnet") {
    candidates = ["Composer 2.5"];
  } else if (primary === "Grok 5.x") {
    candidates = ["Fable 5", "Claude Sonnet", "Composer 2.5"];
  } else if (opts?.hardBug && primary !== "Composer 2.5") {
    candidates = ["GPT-5 Sol", "Claude Sonnet", "Composer 2.5"];
  } else {
    candidates = [];
  }

  // Hard-bug primary Terra: cheaper_fallback prefers Sol then Sonnet
  if (opts?.hardBug && primary === "GPT-5 Codex") {
    candidates = ["GPT-5 Sol", "Claude Sonnet", "Composer 2.5"];
  }

  const out: ModelId[] = [];
  for (const m of candidates) {
    if (m === primary) continue;
    if (blocked.has(m)) continue;
    const slug = CURSOR_TASK_SLUG[m];
    if (!isCursorCatalogSlug(slug)) continue;
    out.push(m);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Step down one (or more) rungs for cheaper_fallback.
 * Hard-bug / Codex → Sol first (same family), then Sonnet.
 * Fable/Opus/Grok → Sonnet for explore; Sonnet → Composer.
 */
export function pickCheaperFallback(
  primary: ModelId,
  opts?: { hardBug?: boolean; unavailable?: Set<ModelId> },
): CheaperFallback {
  const chain = buildFallbackModels(primary, opts);
  const name = chain[0] ?? primary;
  return {
    name,
    slug: CURSOR_TASK_SLUG[name],
    tier: MODEL_TIER[name],
  };
}

/** Host id empty or explicitly marked unavailable */
export function isHostModelAvailable(
  host: string,
  model: ModelId,
  blocked?: Set<ModelId>,
): boolean {
  if (blocked?.has(model)) return false;
  const id = hostModelId(host, model);
  if (!isHostIdAvailable(id)) return false;
  if (host === "cursor" || resolveHostId(host) === "cursor") {
    return isCursorCatalogSlug(id);
  }
  return true;
}

function candidateReason(
  model: ModelId,
  role: "primary" | "alternative" | "fallback",
): string | undefined {
  if (role === "primary") return "task-fit primary";
  if (role === "alternative") return "second-best score";
  return "step-down if unavailable";
}

/** Ordered candidates: primary → alternative → family step-down */
export function buildCandidates(
  primary: ModelId,
  alternative: ModelId,
  host: string,
  opts?: { hardBug?: boolean; unavailable?: Set<ModelId> },
): FallbackCandidate[] {
  const blocked = opts?.unavailable ?? new Set<ModelId>();
  const ordered: ModelId[] = [
    primary,
    alternative,
    ...buildFallbackModels(primary, opts),
  ];
  const seen = new Set<ModelId>();
  const out: FallbackCandidate[] = [];

  for (const model of ordered) {
    if (seen.has(model)) continue;
    if (!isHostModelAvailable(host, model, blocked)) continue;
    seen.add(model);
    const slug = CURSOR_TASK_SLUG[model];
    const id = hostModelId(host, model);
    out.push({
      name: model,
      id,
      slug: isCursorCatalogSlug(slug) ? slug : id,
      reason: candidateReason(
        model,
        out.length === 0 ? "primary" : out.length === 1 ? "alternative" : "fallback",
      ),
    });
    if (out.length >= 5) break;
  }

  // Ensure at least primary attempt even if host map is odd
  if (out.length === 0) {
    const slug = CURSOR_TASK_SLUG[primary];
    out.push({
      name: primary,
      id: hostModelId(host, primary),
      slug: isCursorCatalogSlug(slug) ? slug : hostModelId(host, primary),
      reason: "task-fit primary",
    });
  }
  return out;
}

/** Slug/id chain parallel to candidates (compat) */
export function buildFallbackChain(
  primary: ModelId,
  alternative: ModelId,
  host: string,
  opts?: { hardBug?: boolean; unavailable?: Set<ModelId> },
): string[] {
  return buildCandidates(primary, alternative, host, opts).map(
    (c) => c.slug || c.id,
  );
}

function buildCostAdvice(
  primary: ModelId,
  signals: CommandSignals,
  preferCheaper: boolean,
): UsageEstimate {
  const heavy = primary === "GPT-5 Codex" || primary === "Grok 5.x";
  const light = primary === "Composer 2.5";
  const midClaude =
    primary === "Claude Sonnet" ||
    primary === "Claude Opus" ||
    primary === "Fable 5";

  if (light && (signals.scope === "tiny" || signals.scope === "local")) {
    return {
      ko: "이 작업엔 Composer가 맞음 — Codex·Fable은 과함",
      en: "Composer fits this task — Codex/Fable would be overkill",
    };
  }
  if (
    signals.architecture &&
    !signals.implementation &&
    (primary === "Fable 5" ||
      primary === "Grok 5.x" ||
      primary === "Claude Opus" ||
      primary === "Claude Sonnet")
  ) {
    return {
      ko: `${primary} 적합 — 설계·기획은 Fable/Grok/Opus/Sonnet 중 문맥에 맞게 · 구현은 Composer/Sonnet`,
      en: `${primary} fits design/planning — pick among Fable/Grok/Opus/Sonnet by scope; implement with Composer/Sonnet`,
    };
  }
  if (primary === "Claude Sonnet" && signals.ui && !signals.large_ui) {
    return {
      ko: "Sonnet 적합 — Fable·Codex는 넓은 UI·난해 버그 때만",
      en: "Sonnet is a good fit — reserve Fable/Codex for large UI or hard bugs",
    };
  }
  if (primary === "Fable 5" && signals.large_ui) {
    return {
      ko: signals.large_ui
        ? "넓은 UI엔 Fable 적합 — 작은 패치면 Composer/Sonnet"
        : "Fable은 UI·멀티파일용 — 작은 수정이면 Composer/Sonnet",
      en: signals.large_ui
        ? "Fable fits broad UI — Composer/Sonnet for small patches"
        : "Fable for UI/multi-file — Composer/Sonnet for tiny edits",
    };
  }
  if (primary === "Fable 5") {
    return {
      ko: "UI·멀티파일에 Fable 적합 — 가벼운 패치면 Composer/Sonnet",
      en: "Fable fits UI/multi-file — Composer/Sonnet for light patches",
    };
  }
  if (primary === "Grok 5.x") {
    return {
      ko: "Grok 적합 — 넓은 설계·기획; UI 설계면 Fable/Sonnet도 후보",
      en: "Grok fits broad design/planning — Fable/Sonnet for UI design",
    };
  }
  if (primary === "GPT-5 Codex") {
    return signals.hard_bug
      ? {
          ko: "난해 버그·CI엔 Codex 정당 — 먼저 Sol/Sonnet 탐색 권장",
          en: "Codex justified for hard bugs/CI — try Sol/Sonnet first",
        }
      : {
          ko: "고비용 — 막힐 때만, 평소 Composer/Sonnet 우선",
          en: "High cost — only when stuck; prefer Composer/Sonnet normally",
        };
  }
  if (primary === "GPT-5 Sol") {
    return {
      ko: "Sol은 Codex보다 가벼움 — 막히면 그때 Codex",
      en: "Sol is lighter than Codex — escalate to Codex only if stuck",
    };
  }
  if (heavy && preferCheaper) {
    return {
      ko: "무거운 primary — lighter fallback 먼저 시도 권장",
      en: "Heavy primary — try a lighter fallback first",
    };
  }
  if (midClaude && preferCheaper && !signals.architecture) {
    return {
      ko: `${primary} 적합 — 더 가벼운 패치면 Composer/Sonnet`,
      en: `${primary} fits — Composer/Sonnet if the scope is lighter`,
    };
  }
  return {
    ko: `이 작업엔 ${primary}가 맞음 — relative 참고`,
    en: `${primary} fits this task — see relative for approximate cost`,
  };
}

export function buildCostPreview(
  primary: ModelId,
  primaryCostTier: CostTier,
  signals: CommandSignals,
  preferCheaper: boolean,
): CostPreview {
  return {
    weight: costTierToWeight(primaryCostTier),
    relative: { ...RELATIVE_COST[primary] },
    advice: buildCostAdvice(primary, signals, preferCheaper),
  };
}

function buildUsageEstimate(
  primary: ModelId,
  tokenRisk: TokenRisk,
  preferCheaper: boolean,
  hardBug: boolean,
): UsageEstimate {
  const base = USAGE_ESTIMATE[primary];
  if (!preferCheaper && tokenRisk !== "high") return { ...base };
  if (hardBug && preferCheaper) {
    return {
      en: `${base.en} · prefer_cheaper — explore Sol/Sonnet first, then Composer; Terra if still stuck`,
      ko: `${base.ko} · prefer_cheaper — 탐색은 Sol/Sonnet 먼저, 그다음 Composer; 막히면 Terra`,
    };
  }
  if (preferCheaper) {
    return {
      en: `${base.en} · prefer_cheaper — Composer (bulk) or Sonnet (quality-cheap); ${CLAUDE_LADDER_DOC}`,
      ko: `${base.ko} · prefer_cheaper — 대량은 Composer, 품질 유지 저가는 Sonnet; ${CLAUDE_LADDER_DOC}`,
    };
  }
  if (tokenRisk === "high") {
    return {
      en: `${base.en} · high token risk`,
      ko: `${base.ko} · 토큰 위험 높음`,
    };
  }
  return { ...base };
}

function buildReason(
  primary: ModelId,
  alternative: ModelId,
  signals: CommandSignals,
  fallback: CheaperFallback,
  fallbackChain: string[],
): string {
  const chain =
    fallbackChain.length > 0 ? ` next=${fallbackChain[0]}` : "";
  return `${signals.why} → ${primary} (alt ${alternative}; fb=${fallback.slug}${chain})`;
}

function applyProjectConfig(
  scores: Record<ModelId, number>,
  cfg?: ProjectConfig,
  saveBias = true,
  opts?: { skipDesignPenalty?: boolean },
): void {
  if (saveBias) {
    scores["Composer 2.5"] += 12;
    scores["Claude Sonnet"] += 10;
    scores["GPT-5 Sol"] += 4;
    scores["GPT-5 Codex"] -= 6;
    if (!opts?.skipDesignPenalty) {
      scores["Grok 5.x"] -= 4;
      scores["Fable 5"] -= 4;
    }
  } else if (isQualityBias(cfg)) {
    scores["GPT-5 Codex"] += 8;
    scores["Grok 5.x"] += 6;
    scores["Fable 5"] += 4;
    scores["Claude Opus"] += 4;
  }
  if (!cfg) {
    // still apply blocked from empty
    return;
  }
  if (cfg.default_tier === "low") {
    scores["Composer 2.5"] += 8;
    scores["Claude Sonnet"] += 4;
  } else if (cfg.default_tier === "mid") {
    scores["Fable 5"] += 6;
    scores["Claude Sonnet"] += 4;
    scores["Claude Opus"] += 3;
    scores["Grok 5.x"] += 4;
    scores["GPT-5 Sol"] += 3;
  } else if (cfg.default_tier === "high") {
    scores["GPT-5 Codex"] += 8;
  }
  const blocked = unavailableSet(cfg);
  for (const id of blocked) {
    scores[id] -= 200;
  }
}

function makeRecommendationId(
  text: string,
  primary: ModelId,
  alternative: ModelId,
): string {
  const h = createHash("sha256")
    .update(`${text}|${primary}|${alternative}|${Date.now()}`)
    .digest("hex")
    .slice(0, 12);
  return `rec_${h}_${randomBytes(2).toString("hex")}`;
}

/**
 * If primary/alt blocked or unavailable, pick next by score then family ladder.
 * Never returns a model outside MODELS / catalog.
 */
function ensureNotBlocked(
  primary: ModelId,
  alternative: ModelId,
  scores: Record<ModelId, number>,
  cfg?: ProjectConfig,
  opts?: { hardBug?: boolean },
): [ModelId, ModelId] {
  const blocked = unavailableSet(cfg);
  const ranked = [...MODELS].sort((x, y) => scores[y] - scores[x]);
  const pick = (exclude?: ModelId): ModelId => {
    const fromScores = ranked.find((m) => !blocked.has(m) && m !== exclude);
    if (fromScores) return fromScores;
    // hard-bug ladder: Terra → Sol → Sonnet → Composer
    if (opts?.hardBug) {
      for (const m of [
        "GPT-5 Codex",
        "GPT-5 Sol",
        "Claude Sonnet",
        "Composer 2.5",
      ] as ModelId[]) {
        if (!blocked.has(m) && m !== exclude) return m;
      }
    }
    return exclude ?? "Composer 2.5";
  };

  let p = primary;
  let a = alternative;
  if (blocked.has(p)) {
    p = pick();
  }
  if (blocked.has(a) || a === p) {
    a = pick(p);
  }
  // Ensure Cursor catalog slugs only
  if (!isCursorCatalogSlug(CURSOR_TASK_SLUG[p])) {
    p = "Composer 2.5";
  }
  if (!isCursorCatalogSlug(CURSOR_TASK_SLUG[a]) || a === p) {
    a = pick(p);
  }
  return [p, a];
}

export function recommendModel(input: RecommendInput): RecommendResult {
  const text = input.task_description ?? "";
  const tags = input.tags ?? [];
  const cfg = input.project_config;
  const hostRaw = input.host ?? cfg?.preferred_host;
  const host = resolveHostId(hostRaw);
  const signals = analyzeCommand(text, tags);
  const token_risk = estimateTokenRisk(text, tags);
  const hardBug = signals.hard_bug;
  const uiTask = signals.ui;
  const blocked = unavailableSet(cfg);
  const scores: Record<ModelId, number> = { ...BASE };

  for (const tag of tags) {
    const boost = TAG_BOOST[tag];
    if (boost) addScores(scores, boost);
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) addScores(scores, rule.boost);
  }

  // Scope nudges from command length / verbs
  if (signals.scope === "tiny") {
    scores["Composer 2.5"] += 25;
    scores["Fable 5"] -= 10;
    scores["GPT-5 Codex"] -= 8;
  } else if (signals.scope === "huge" || signals.scope === "broad") {
    if (!hardBug && !signals.large_ui) {
      scores["Composer 2.5"] += 20;
      scores["Fable 5"] -= 8;
    }
  }

  // 아키텍처 태그는 구현 전체 Grok 고정 방지: 대안이 Composer/Sonnet/Fable이 되게
  if (signals.architecture && !uiTask) {
    scores["Composer 2.5"] += 5;
    scores["Claude Sonnet"] += 3;
  }

  const saveBias = effectiveSaveBias(cfg, signals.budget);
  const prefer_cheaper =
    saveBias ||
    token_risk === "high" ||
    !!input.usage_prefer_cheaper;

  // high + bulk/mechanical (not hard bug, not large UI): boost cheaper
  if (prefer_cheaper && !hardBug && !signals.large_ui && isBulkMechanical(text)) {
    scores["Composer 2.5"] += 55;
    scores["GPT-5 Codex"] -= 20;
    scores["GPT-5 Sol"] -= 8;
    scores["Fable 5"] -= 10;
  }

  // Default save + normal UI: Sonnet over Fable (unless large redesign)
  if (prefer_cheaper && uiTask && !hardBug && !signals.large_ui) {
    scores["Claude Sonnet"] += 40;
    scores["Fable 5"] -= 25;
    scores["Composer 2.5"] += 8;
  }

  // Clear escalate: large UI redesign → Fable
  if (signals.large_ui && !hardBug) {
    scores["Fable 5"] += 55;
    scores["Claude Sonnet"] += 5;
  }

  // 설계+구현 혼합 → 구현 신호 우선
  if (signals.architecture && signals.implementation && !hardBug) {
    scores["Composer 2.5"] += 45;
    scores["Grok 5.x"] -= 25;
    scores["Fable 5"] -= 10;
    if (uiTask) {
      scores["Fable 5"] += 40;
      scores["Composer 2.5"] -= 15;
    }
  }

  // 설계·기획: Fable/Grok/Opus/Sonnet 경쟁 (Fable 단독 고정 없음)
  if (signals.architecture && !uiTask && !signals.implementation) {
    if (signals.budget === "premium") {
      scores["Grok 5.x"] += 12;
      scores["Fable 5"] += 10;
      scores["Claude Opus"] += 8;
    }
    if (prefer_cheaper && signals.budget !== "premium") {
      scores["Claude Sonnet"] += 8;
      scores["Grok 5.x"] += 4;
    }
  }

  const pureDesign =
    signals.architecture && !signals.implementation && !uiTask;
  applyProjectConfig(scores, cfg, saveBias && !signals.large_ui, {
    skipDesignPenalty: pureDesign,
  });

  if (input.feedback_adjust) {
    for (const [k, v] of Object.entries(input.feedback_adjust) as [
      ModelId,
      number,
    ][]) {
      if (typeof v === "number" && Number.isFinite(v)) scores[k] += v;
    }
  }

  let [primary, alternative] = topTwo(scores);

  // Escalation overrides (command clearly needs it)
  if (hardBug) {
    const bugPrimary: ModelId | undefined = (
      ["GPT-5 Codex", "GPT-5 Sol", "Claude Sonnet", "Composer 2.5"] as ModelId[]
    ).find((m) => !blocked.has(m));
    if (bugPrimary && primary !== bugPrimary) {
      alternative = primary === bugPrimary ? alternative : primary;
      primary = bugPrimary;
    }
  } else if (signals.large_ui && !hardBug && !blocked.has("Fable 5")) {
    if (primary !== "Fable 5") {
      alternative = primary;
      primary = "Fable 5";
    }
  } else if (prefer_cheaper) {
    // UI quality-cheap: Sonnet (or Composer if Sonnet blocked)
    if (uiTask && !hardBug && !signals.large_ui) {
      // 일반 UI = Sonnet (절약). Sonnet 불가 시 Composer.
      let qualityCheap: ModelId = blocked.has("Claude Sonnet")
        ? "Composer 2.5"
        : "Claude Sonnet";
      if (blocked.has(qualityCheap)) qualityCheap = "Composer 2.5";
      if (primary !== qualityCheap && !blocked.has(qualityCheap)) {
        alternative = primary;
        primary = qualityCheap;
      }
    } else if (!hardBug && !uiTask && isBulkMechanical(text)) {
      const cheap: ModelId = "Composer 2.5";
      if (!blocked.has(cheap) && primary !== cheap) {
        alternative = primary;
        primary = cheap;
      } else if (alternative === cheap) {
        const ranked = [...MODELS].sort((a, b) => scores[b] - scores[a]);
        alternative =
          ranked.find((m) => m !== cheap && !blocked.has(m)) ?? alternative;
      }
    }
  }

  const currentResolved =
    resolveModelId(input.current_model) ??
    resolveModelIdFromHostId(input.current_model, host);

  const designToImpl =
    currentResolved != null &&
    isDesignRoleModel(currentResolved) &&
    signals.implementation;

  if (
    designToImpl ||
    (signals.architecture && signals.implementation && !hardBug)
  ) {
    const implPrimary: ModelId =
      uiTask && !blocked.has("Fable 5")
        ? "Fable 5"
        : blocked.has("Composer 2.5")
          ? "Claude Sonnet"
          : "Composer 2.5";
    if (primary !== implPrimary && !blocked.has(implPrimary)) {
      alternative = primary;
      primary = implPrimary;
    }
  }

  [primary, alternative] = ensureNotBlocked(primary, alternative, scores, cfg, {
    hardBug,
  });

  const fbOpts = { hardBug, unavailable: blocked };
  const cheaper_fallback = pickCheaperFallback(primary, fbOpts);
  const cheaper_fallback_slug = cheaper_fallback.slug;
  const candidates = buildCandidates(primary, alternative, host, fbOpts);
  const fallback_chain = candidates.map((c) => c.slug || c.id);

  let stick_action: "keep" | "switch" | undefined;
  if (currentResolved != null) {
    if (designToImpl) {
      stick_action = "switch";
    } else if (currentResolved === primary) {
      stick_action = "keep";
    } else {
      stick_action = "switch";
    }
  }

  let reason = buildReason(
    primary,
    alternative,
    signals,
    cheaper_fallback,
    fallback_chain,
  );
  if (stick_action === "keep") {
    reason = `모델 유지 · ${reason}`;
  } else if (stick_action === "switch") {
    reason = `${primary}로 전환 · ${reason}`;
  }

  const model_persistence =
    stick_action != null
      ? buildModelPersistenceNote(stick_action, primary)
      : undefined;

  const recommendation_id = makeRecommendationId(text, primary, alternative);

  const primary_slug =
    catalogSlugOrNull(CURSOR_TASK_SLUG[primary]) ?? "composer-2.5-fast";
  const alternative_slug =
    catalogSlugOrNull(CURSOR_TASK_SLUG[alternative]) ?? "composer-2.5-fast";

  const primary_id = hostModelId(host, primary);
  const primary_cost_tier = COST_TIER[primary];

  const base: RecommendResult = {
    primary,
    alternative,
    reason,
    scores,
    primary_slug,
    alternative_slug,
    host,
    primary_id,
    alternative_id: hostModelId(host, alternative),
    primary_cost_tier,
    alternative_cost_tier: COST_TIER[alternative],
    primary_tier: MODEL_TIER[primary],
    alternative_tier: MODEL_TIER[alternative],
    token_risk,
    prefer_cheaper,
    cheaper_fallback,
    cheaper_fallback_slug:
      catalogSlugOrNull(cheaper_fallback_slug) ?? cheaper_fallback_slug,
    candidates,
    fallback_chain: fallback_chain.filter(Boolean),
    usage_estimate: buildUsageEstimate(
      primary,
      token_risk,
      prefer_cheaper,
      hardBug,
    ),
    recommendation_id,
    for_task: {
      primary,
      primary_id,
      cost_tier: primary_cost_tier,
    },
    clarity: { ko: "", en: "" },
    cost_preview: buildCostPreview(
      primary,
      primary_cost_tier,
      signals,
      prefer_cheaper,
    ),
    honest_limit: { ko: "", en: "" },
    ...(stick_action
      ? {
          stick_action,
          current_resolved: currentResolved,
          model_persistence,
          ...(stick_action === "keep"
            ? { sticky_suggest: "keep_silent" as const }
            : {}),
        }
      : {}),
  };

  const { clarity, honest_limit } = buildRecommendClarity(base);
  return { ...base, clarity, honest_limit };
}

/** One-line clarity: task recommendation ≠ MCP caller model */
export function buildRecommendClarity(result: RecommendResult): {
  for_task: RecommendResult["for_task"];
  clarity: UsageEstimate;
  cost_preview: CostPreview;
  honest_limit: UsageEstimate;
} {
  const {
    primary,
    primary_id,
    primary_cost_tier,
    cost_preview,
    model_persistence,
  } = result;
  const weightKo =
    cost_preview.weight === "light"
      ? "가벼움"
      : cost_preview.weight === "heavy"
        ? "무거움"
        : "보통";
  const persistKo = model_persistence ? ` ${model_persistence.ko}.` : "";
  const persistEn = model_persistence ? ` ${model_persistence.en}.` : "";
  return {
    for_task: {
      primary,
      primary_id,
      cost_tier: primary_cost_tier,
    },
    clarity: {
      ko: `작업용 추천: ${primary} (${primary_id}, ${weightKo}). ${cost_preview.advice.ko}.${persistKo} MCP 호출 모델과 별개.`,
      en: `Task recommendation: ${primary} (${primary_id}, ${cost_preview.weight}). ${cost_preview.advice.en}.${persistEn} Separate from MCP caller.`,
    },
    cost_preview,
    honest_limit: {
      ko: "Cursor UI 모델은 자동 전환되지 않습니다. MCP를 호출한 에이전트/워커(예: Composer)와 작업용 추천(primary)은 다를 수 있습니다.",
      en: "Cursor does not auto-switch the chat model. The agent/worker that called this MCP (e.g. Composer) may differ from the task recommendation (primary).",
    },
  };
}

/** Task worker hint — always use primary_id unless host says unavailable */
export function buildRunHint(result: RecommendResult): {
  ko: string;
  en: string;
  task_model: string;
  fallback_model: string;
} {
  const fb =
    result.candidates[1]?.id ??
    result.candidates[1]?.slug ??
    result.cheaper_fallback_slug;
  return {
    task_model: result.primary_id,
    fallback_model: fb,
    ko: `다음 Task model=${result.primary_id} (불가 시 ${fb}) → log_model_usage → set_sticky`,
    en: `Next Task model=${result.primary_id} (if unavailable ${fb}) → log_model_usage → set_sticky`,
  };
}

const AGENT_NOTE = {
  ko: "실제 작업(Task/subagent)은 primary_id로 실행. MCP 호출 모델(예: Composer)과 다를 수 있음. unavailable → candidates[1].id. 주인님껀 sticky 단어 금지 — model_persistence 사용.",
  en: "Run real work (Task/subagent) with primary_id — may differ from MCP caller. If unavailable → candidates[1].id. Never say sticky to user — use model_persistence.",
} as const;

/** Compact tool payload — default for agents (token-light) */
export function compactRecommendResult(
  result: RecommendResult,
): Record<string, unknown> {
  const { for_task, clarity, cost_preview, honest_limit } =
    buildRecommendClarity(result);
  const run_hint = buildRunHint(result);
  return {
    primary: result.primary,
    alternative: result.alternative,
    for_task,
    clarity,
    cost_preview,
    honest_limit,
    primary_slug: result.primary_slug,
    primary_id: result.primary_id,
    cheaper_fallback_slug: result.cheaper_fallback_slug,
    candidates: result.candidates,
    fallback_chain: result.fallback_chain,
    token_risk: result.token_risk,
    prefer_cheaper: result.prefer_cheaper,
    reason: result.reason,
    host: result.host,
    recommendation_id: result.recommendation_id,
    run_hint,
    agent_note: AGENT_NOTE,
    ...(result.stick_action
      ? {
          stick_action: result.stick_action,
          model_persistence: result.model_persistence,
          sticky_suggest: result.sticky_suggest,
        }
      : {}),
  };
}
