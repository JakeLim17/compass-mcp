/**
 * ChronoCode model scoring SSOT.
 * Claude family: Composer (Cursor-cheap) < Sonnet < Opus < Fable
 * GPT/Codex family: Sol (cheaper) < Terra/Codex (heavier)
 * Only recommend Cursor catalog slugs for host=cursor.
 */
import {
  hostModelId,
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
  "Claude: Composer < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex (catalog-only; Grok = design-mid)";

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
    en: "heavier design/reasoning — design only, then hand off",
    ko: "무거운 설계·추론 — 설계만 하고 구현은 넘김",
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
    if (lower.includes("design")) return "Grok 5.x";
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
   * Short catalog slug list after primary (blocked/unavailable → try next).
   * Agents: if subagent fails unavailable, retry next in this chain.
   */
  fallback_chain: string[];
  /** Short EN+KO hint about when this weight is worth it */
  usage_estimate: UsageEstimate;
  /** Idempotent-ish id for feedback_recommendation */
  recommendation_id: string;
  /** current_model 있을 때: keep = 그대로 / switch = 전환 제안 */
  stick_action?: "keep" | "switch";
  current_resolved?: ModelId | null;
  /** When keep: soft hint to stay quiet */
  sticky_suggest?: "keep_silent";
  /** Task recommendation — distinct from the agent that called this MCP */
  for_task: {
    primary: ModelId;
    primary_id: string;
    cost_tier: CostTier;
  };
  /** One-line KO/EN: recommended model vs caller */
  clarity: UsageEstimate;
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
  architecture: { "Grok 5.x": 45, "Fable 5": 10, "Claude Opus": 5 },
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
    re: /설계|구조|아키텍처|기술\s*선택|어떻게\s*짤|기획|트레이드.?오프|의사결정/i,
    boost: { "Grok 5.x": 40, "Fable 5": 8, "Claude Opus": 5 },
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
    /설계|구조|아키텍처|트레이드.?오프|기술\s*선택|의사결정/i.test(t);
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
  } else if (architecture && !ui) {
    why = "설계·트레이드오프 → Grok(설계만)";
  } else if (large_ui) {
    why = "넓은 UI 리디자인 → Fable 에스컬레이션";
  } else if (scope === "tiny" || TINY_SCOPE_RE.test(t)) {
    why = "한 줄·작은 패치 → Composer(최소)";
  } else if (ui) {
    why = "일반 UI → Sonnet(절약 기본, Fable 보류)";
  } else if (scope === "broad" || scope === "huge") {
    why = "넓은/대량 범위 → Composer로 토큰 절약";
  } else {
    why = "기본 절약: 명령에 고가 에스컬레이션 신호 없음";
  }

  return {
    char_len,
    scope,
    budget,
    hard_bug,
    large_ui,
    architecture,
    ui,
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
    candidates = ["Claude Sonnet", "Composer 2.5"];
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

/** Catalog slug chain for agent retry when primary unavailable */
export function buildFallbackChain(
  primary: ModelId,
  opts?: { hardBug?: boolean; unavailable?: Set<ModelId> },
): string[] {
  return buildFallbackModels(primary, opts)
    .map((m) => CURSOR_TASK_SLUG[m])
    .filter((s) => isCursorCatalogSlug(s));
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
): void {
  if (saveBias) {
    scores["Composer 2.5"] += 12;
    scores["Claude Sonnet"] += 10;
    scores["GPT-5 Sol"] += 4;
    scores["GPT-5 Codex"] -= 6;
    scores["Grok 5.x"] -= 4;
    scores["Fable 5"] -= 4;
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

  applyProjectConfig(scores, cfg, saveBias && !signals.large_ui);

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
  } else if (signals.architecture && !uiTask && !blocked.has("Grok 5.x")) {
    if (primary !== "Grok 5.x") {
      alternative = primary;
      primary = "Grok 5.x";
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

  [primary, alternative] = ensureNotBlocked(primary, alternative, scores, cfg, {
    hardBug,
  });

  const fbOpts = { hardBug, unavailable: blocked };
  const cheaper_fallback = pickCheaperFallback(primary, fbOpts);
  const cheaper_fallback_slug = cheaper_fallback.slug;
  const fallback_chain = buildFallbackChain(primary, fbOpts);

  const currentResolved =
    resolveModelId(input.current_model) ??
    resolveModelIdFromHostId(input.current_model, host);
  const stick_action =
    currentResolved == null
      ? undefined
      : currentResolved === primary
        ? ("keep" as const)
        : ("switch" as const);

  let reason = buildReason(
    primary,
    alternative,
    signals,
    cheaper_fallback,
    fallback_chain,
  );
  if (stick_action === "keep") {
    reason = `sticky keep · ${reason}`;
  } else if (stick_action === "switch") {
    reason = `switch→${primary} · ${reason}`;
  }

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
    fallback_chain: fallback_chain.filter((s) => isCursorCatalogSlug(s)),
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
    honest_limit: { ko: "", en: "" },
    ...(stick_action
      ? {
          stick_action,
          current_resolved: currentResolved,
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
  honest_limit: UsageEstimate;
} {
  const { primary, primary_id, primary_cost_tier } = result;
  return {
    for_task: {
      primary,
      primary_id,
      cost_tier: primary_cost_tier,
    },
    clarity: {
      ko: `작업용 추천: ${primary} (${primary_id}). 이 MCP를 호출한 채팅/워커 모델과는 별개입니다.`,
      en: `Task recommendation: ${primary} (${primary_id}). Separate from the chat/worker model that invoked this MCP.`,
    },
    honest_limit: {
      ko: "Cursor UI 모델은 자동 전환되지 않습니다. MCP를 호출한 에이전트/워커(예: Composer)와 작업용 추천(primary)은 다를 수 있습니다.",
      en: "Cursor does not auto-switch the chat model. The agent/worker that called this MCP (e.g. Composer) may differ from the task recommendation (primary).",
    },
  };
}

/** Compact tool payload — default for agents (token-light) */
export function compactRecommendResult(
  result: RecommendResult,
): Record<string, unknown> {
  const { for_task, clarity, honest_limit } = buildRecommendClarity(result);
  return {
    primary: result.primary,
    alternative: result.alternative,
    for_task,
    clarity,
    honest_limit,
    primary_slug: result.primary_slug,
    primary_id: result.primary_id,
    cheaper_fallback_slug: result.cheaper_fallback_slug,
    fallback_chain: result.fallback_chain,
    token_risk: result.token_risk,
    prefer_cheaper: result.prefer_cheaper,
    reason: result.reason,
    host: result.host,
    recommendation_id: result.recommendation_id,
    ...(result.stick_action
      ? {
          stick_action: result.stick_action,
          sticky_suggest: result.sticky_suggest,
        }
      : {}),
  };
}
