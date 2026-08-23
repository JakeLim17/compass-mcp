/**
 * ChronoCode model scoring SSOT.
 * Goal: task-fit model — not “always cheapest”, not vendor-locked.
 * Light patch / copy → host lightest (Cursor=Composer, Claude=Haiku, GPT=Mini) · UI → Sonnet/Fable
 * · design/plan → Fable/Grok/Opus/Sonnet · hard CI/bug → Codex/Terra.
 * Claude ladder: lightest < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex
 * Only recommend Cursor catalog slugs for host=cursor.
 */
import {
  hostLightestLabel,
  LIGHTEST_LOGICAL,
  resolveHostId,
  resolveModelIdFromHostId,
  isHostIdAvailable,
  hostModelId,
  CURSOR_UI_STANDARD_SLUGS,
} from "./hosts.js";
import type { ProjectConfig } from "./projectConfig.js";
import { createHash, randomBytes } from "node:crypto";
import { buildMustDo } from "./mustDo.js";
import { detectVerbalModelRequest } from "./verbalOverride.js";
import { mergeTaskContext } from "./taskContext.js";

export type ModelId =
  | "Composer 2.5"
  | "Claude Sonnet"
  | "Claude Opus"
  | "Opus 5"
  | "Fable 5"
  | "Grok 5.x"
  | "GPT-5 Sol"
  | "GPT-5 Codex"
  | "Kimi K2.7";

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
/**
 * Chat/subagent Standard (non-Fast) slugs — verified (Cursor forum cloud list, Aug 2026).
 * Task inline `model` often exposes `-fast` only; Standard = UI picker Fast off or `.cursor/agents/` frontmatter.
 */
export const CURSOR_STANDARD_SLUG: Partial<Record<ModelId, string>> = {
  "Composer 2.5": "composer-2.5",
};

/** Grok 4.5 legacy Standard (4.6 high non-fast not in cloud Task list yet — UI: turn Fast off) */
export const CURSOR_LEGACY_STANDARD_SLUG: Record<string, ModelId> = {
  "cursor-grok-4.5-high": "Grok 5.x",
};

/** Cursor docs: https://cursor.com/docs/models-and-pricing — recheck when new models ship */
export const CURSOR_AGENT_CATALOG = [
  "composer-2.5-fast",
  "claude-sonnet-5-thinking-high",
  "claude-opus-5-thinking-high",
  "claude-opus-4-8-thinking-high",
  "claude-fable-5-thinking-high",
  "cursor-grok-4.6-high-fast",
  "cursor-grok-4.5-high-fast",
  "gpt-5.6-sol-medium",
  "gpt-5.6-terra-medium",
  "kimi-k2.7-code",
] as const;

/** Resolve/sticky only — not default-scored or recommended */
export const CURSOR_LEGACY_SLUGS: Record<string, ModelId> = {
  "cursor-grok-4.5-high-fast": "Grok 5.x",
};

export type CursorCatalogSlug = (typeof CURSOR_AGENT_CATALOG)[number];

export const CURSOR_CATALOG_SET = new Set<string>([
  ...CURSOR_AGENT_CATALOG,
  ...CURSOR_UI_STANDARD_SLUGS,
]);

/** Resolve/sticky only — not default-scored */
export const CURSOR_OPTIONAL_SLUGS = new Set<string>([]);

/**
 * Claude-family ladder (logical roles). Lightest host id varies:
 * cursor=Composer slug · claude=Haiku · generic=role:lightest.
 */
export const CLAUDE_FAMILY_LADDER: ModelId[] = [
  LIGHTEST_LOGICAL,
  "Claude Sonnet",
  "Claude Opus",
  "Opus 5",
  "Fable 5",
];

/** GPT/Codex family: Sol (cheaper) < Terra/Codex (heavier) */
export const GPT_FAMILY_LADDER: ModelId[] = ["GPT-5 Sol", "GPT-5 Codex"];

export const CLAUDE_LADDER_DOC =
  "lightest(host): Cursor=Composer · Claude=Haiku · GPT=Mini · mid: Sonnet < Opus < Fable · GPT: Sol < Terra · design: Fable/Grok/Opus/Sonnet";

export const GPT_LADDER_DOC = "Sol < Terra/Codex";

/** Relative cost map */
export const COST_TIER: Record<ModelId, CostTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "medium",
  "Claude Opus": "medium-high",
  "Opus 5": "medium-high",
  "Fable 5": "medium-high",
  "Grok 5.x": "medium-high",
  "GPT-5 Sol": "medium-high",
  "GPT-5 Codex": "high",
  "Kimi K2.7": "medium",
};

/** Coarse tier */
export const MODEL_TIER: Record<ModelId, ModelTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "mid",
  "Claude Opus": "mid",
  "Opus 5": "high",
  "Fable 5": "mid",
  "Grok 5.x": "mid",
  "GPT-5 Sol": "mid",
  "GPT-5 Codex": "high",
  "Kimi K2.7": "mid",
};

/** Approximate relative burn vs Composer Standard=1× — Fast ≈6× input (docs pricing) */
const RELATIVE_COST: Record<ModelId, UsageEstimate> = {
  "Composer 2.5": {
    ko: "Composer Standard ≈1× ($0.5/$2.5) — Fast ≈6× ($3/$15), 간단 작업은 Standard",
    en: "Composer Standard ≈1× ($0.5/$2.5) — Fast ≈6× ($3/$15); use Standard for light work",
  },
  "Claude Sonnet": { ko: "Sonnet ≈2×", en: "Sonnet ≈2×" },
  "Claude Opus": { ko: "Opus 4.8 ≈2–3×", en: "Opus 4.8 ≈2–3×" },
  "Opus 5": {
    ko: "Opus 5 ≈2–3× (Fable급, 드물게만)",
    en: "Opus 5 ≈2–3× (Fable-class — use rarely)",
  },
  "Fable 5": { ko: "Fable ≈2–3×", en: "Fable ≈2–3×" },
  "Grok 5.x": {
    ko: "Grok 4.6 Standard ≈2× Composer Standard — Fast ≈2× Standard; 설계·장기 에이전트, 일상 패치는 Composer Standard",
    en: "Grok 4.6 Standard ≈2× Composer Standard — Fast ≈2× Standard; design/long agents; daily patches → Composer Standard",
  },
  "GPT-5 Sol": { ko: "Sol ≈2–3×", en: "Sol ≈2–3×" },
  "GPT-5 Codex": { ko: "Codex/Terra ≈4–5× (고비용)", en: "Codex/Terra ≈4–5× (high)" },
  "Kimi K2.7": {
    ko: "Kimi K2.7 ≈1.5–2× — 긴 코드 컨텍스트·저가 대안",
    en: "Kimi K2.7 ≈1.5–2× — long code context, lower-cost option",
  },
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
    en: "Opus 4.8 — stronger Claude than Sonnet",
    ko: "Opus 4.8 — Sonnet보다 강한 Claude",
  },
  "Opus 5": {
    en: "Opus 5 — extreme difficulty / huge scope only (rare)",
    ko: "Opus 5 — 초대형·최고 난이도만 (드물게)",
  },
  "Fable 5": {
    en: "mid-weight multi-file / UI job (Cursor high Claude)",
    ko: "중간 무게 멀티파일·UI 작업 (Cursor 고가 Claude)",
  },
  "Grok 5.x": {
    en: "Grok 4.6 — long-horizon design/planning & agentic tradeoffs (not light patch)",
    ko: "Grok 4.6 — 장기 설계·기획·에이전트 트레이드오프 (가벼운 패치용 아님)",
  },
  "GPT-5 Sol": {
    en: "cheaper GPT tier — mid reasoning without Terra burn",
    ko: "저가 GPT — Terra/Codex보다 싸게 추론",
  },
  "GPT-5 Codex": {
    en: "Terra/Codex-class — prefer when stuck on CI/hard bugs",
    ko: "Terra/Codex급 — CI·난해한 버그에 막혔을 때",
  },
  "Kimi K2.7": {
    en: "Kimi K2.7 — long codebase reads / code-heavy context",
    ko: "Kimi K2.7 — 긴 코드 컨텍스트·대형 리포 분석",
  },
};

export interface RecommendInput {
  task_description: string;
  /** Recent 2–5 turn summary or raw excerpt (max ~2000 chars) */
  conversation_context?: string;
  /** Alias of conversation_context — merged if both set */
  recent_turns?: string;
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
  "Opus 5": "claude-opus-5-thinking-high",
  "Fable 5": "claude-fable-5-thinking-high",
  "Grok 5.x": "cursor-grok-4.6-high-fast",
  "GPT-5 Sol": "gpt-5.6-sol-medium",
  "GPT-5 Codex": "gpt-5.6-terra-medium",
  "Kimi K2.7": "kimi-k2.7-code",
};

const SLUG_TO_MODEL: Record<string, ModelId> = {
  ...Object.fromEntries(
    (Object.entries(CURSOR_TASK_SLUG) as [ModelId, string][]).map(([id, slug]) => [
      slug,
      id,
    ]),
  ),
  ...Object.fromEntries(
    (Object.entries(CURSOR_STANDARD_SLUG) as [ModelId, string][]).map(([id, slug]) => [
      slug,
      id,
    ]),
  ),
  ...CURSOR_LEGACY_SLUGS,
  ...CURSOR_LEGACY_STANDARD_SLUG,
} as Record<string, ModelId>;

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
  if (lower.includes("haiku")) return LIGHTEST_LOGICAL;
  if (lower.includes("composer")) return LIGHTEST_LOGICAL;
  if (lower.includes("mini") || lower.includes("nano")) return LIGHTEST_LOGICAL;
  if (lower.includes("sonnet")) return "Claude Sonnet";
  if (lower.includes("opus 5") || lower.includes("opus5") || lower.includes("오퍼스 5"))
    return "Opus 5";
  if (lower.includes("opus")) return "Claude Opus";
  if (lower.includes("fable")) return "Fable 5";
  if (lower.includes("grok")) return "Grok 5.x";
  if (lower.includes("kimi") || lower.includes("키미")) return "Kimi K2.7";
  if (lower.includes("terra") || lower.includes("codex")) return "GPT-5 Codex";
  if (lower.includes("sol") || lower === "gpt-5.6-sol-medium") return "GPT-5 Sol";
  if (lower.includes("gpt-5") || lower.includes("gpt5")) return "GPT-5 Codex";
  if (lower.startsWith("role:")) {
    if (lower.includes("lightest") || lower.includes("light") || lower.includes("cheap"))
      return LIGHTEST_LOGICAL;
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
  /**
   * Chat UI / parent agent picker — Standard (non-Fast) when Task slug is -fast only.
   * e.g. composer-2.5 vs task primary_id composer-2.5-fast
   */
  ui_recommended_id?: string;
  ui_recommended_note?: UsageEstimate;
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
  /** 주인님 말 지정 (task_description explicit model request) */
  verbal_override?: {
    requested: ModelId;
    label: string;
    applied: boolean;
    /** 말 지정은 이번 턴만 — set_sticky 영구 저장 금지 */
    one_shot?: boolean;
  };
  /** Tier/work-kind dropped — agent must switch Task.model to primary_id */
  tier_switch?: boolean;
  /** Conversation context used for classification */
  context_meta?: {
    has_context: boolean;
    context_informed: boolean;
    ambiguous_short: boolean;
  };
}

const MODELS: ModelId[] = [
  "Composer 2.5",
  "Claude Sonnet",
  "Claude Opus",
  "Opus 5",
  "Fable 5",
  "Grok 5.x",
  "GPT-5 Sol",
  "GPT-5 Codex",
  "Kimi K2.7",
];

/** 기본 비중 반영 베이스 점수 */
const BASE: Record<ModelId, number> = {
  "Composer 2.5": 40,
  "Claude Sonnet": 12,
  "Claude Opus": 6,
  "Opus 5": 2,
  "Fable 5": 15,
  "Grok 5.x": 10,
  "GPT-5 Sol": 4,
  "GPT-5 Codex": 5,
  "Kimi K2.7": 6,
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
    "Opus 5": 8,
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
      "Opus 5": 6,
      "Claude Sonnet": 10,
    },
  },
  {
    re: /긴\s*컨텍스트|long[- ]?context|대형\s*코드|whole\s*repo|수천\s*줄|코드베이스\s*전체\s*(분석|읽|훑)|large\s*codebase\s*(review|read)|many\s*files.*(?:read|분석|리뷰)/i,
    boost: { "Kimi K2.7": 42, "Claude Sonnet": 10, "Composer 2.5": -8 },
  },
  {
    re: /최고\s*난이도|초대형|극한|maximum\s*effort|hardest|opus\s*5|오퍼스\s*5/i,
    boost: { "Opus 5": 35, "GPT-5 Codex": 12, "Grok 5.x": 8 },
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
    re: /i18n|문구|카피|타이포|typo|copy\s*edit|문구\s*수정|카피\s*한\s*줄|로그인\s*문구|슬로건|slogan|cta\s*텍스트|hero\s*text/i,
    boost: { [LIGHTEST_LOGICAL]: 45 },
  },
  {
    re: /font|글꼴|폰트|typography|font-family|fontFamily/i,
    boost: { [LIGHTEST_LOGICAL]: 32, "Claude Sonnet": -6, "Fable 5": -8 },
  },
  {
    re: /주석|lint|작은|퀵|핫픽스|한\s*줄|one[- ]?line/i,
    boost: { [LIGHTEST_LOGICAL]: 28 },
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
  /한\s*줄|one[- ]?line|i18n|타이포|typo|문구\s*수정|작은\s*(수정|패치|카피|문구)|주석\s*만|lint\s*만|퀵\s*(픽스|패치)|hot\s*fix|카피\s*한\s*줄|슬로건|slogan|폰트|글꼴|font|히어로\s*영어|영어\s*슬로건/i;

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
  /구현|코딩|만들자|구현해보자|구현\s*들어가|코드\s*작|개발해|implement|build\s*it|write\s*code|coding|만들어\s*줘|코딩해/i;

export function isImplementationTask(text: string): boolean {
  return IMPLEMENTATION_RE.test(text ?? "");
}

/** Models typically used for design/planning (hand off when task shifts to build) */
export const DESIGN_ROLE_MODELS: ModelId[] = [
  "Fable 5",
  "Grok 5.x",
  "Claude Opus",
  "Opus 5",
  "Claude Sonnet",
];

/** Heavy design models — after design, implementation defaults to Sonnet (save gate) */
export const DESIGN_HANDOFF_MODELS: ModelId[] = [
  "Fable 5",
  "Grok 5.x",
  "Claude Opus",
  "Opus 5",
];

export function isDesignRoleModel(model: ModelId): boolean {
  return (DESIGN_ROLE_MODELS as string[]).includes(model);
}

export function isDesignHandoffModel(model: ModelId): boolean {
  return (DESIGN_HANDOFF_MODELS as string[]).includes(model);
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

/** Long code context read — Kimi tier (not design/planning) */
export const LONG_CODE_CONTEXT_RE =
  /긴\s*컨텍스트|long[- ]?context|whole\s*repo|코드베이스\s*전체\s*(분석|읽|훑)|large\s*codebase\s*(review|read)|many\s*files.*(?:read|분석|리뷰)/i;

export function isLongCodeContextTask(text: string, tags: Tag[] = []): boolean {
  const t = text ?? "";
  if (!LONG_CODE_CONTEXT_RE.test(t)) return false;
  if (isCopyOnlyTask(t) || isLightUiCopyOrFontTask(t, tags)) return false;
  // design/planning verbs without read/analyze → not Kimi primary
  if (
    /설계|기획|트레이드.?오프|wireframe|와이어/i.test(t) &&
    !/(분석|읽|review|read|훑)/i.test(t)
  ) {
    return false;
  }
  return true;
}

/** Copy/i18n/typo only — host lightest tier (not mid models) */
export const COPY_ONLY_RE =
  /i18n|문구|카피|타이포|typo|copy\s*edit|문구\s*수정|카피\s*한\s*줄|로그인\s*문구|문구\s*만|카피\s*만|슬로건|slogan|cta\s*텍스트|cta\s*문구|hero\s*text|subtitle|서브타이틀/i;

/** Hero/landing copy tweaks — still light tier even when UI keywords appear */
export const LIGHT_COPY_RE =
  /슬로건|slogan|영어\s+(문구|슬로건|텍스트|카피)|hero\s*(text|copy|slogan)|히어로\s*(영어|문구|텍스트|슬로건|카피)|cta\s*(텍스트|문구|버튼)|랜딩\s*문구|headline|tagline/i;

/** Font/typography apply bug — narrow style fix, not layout refactor */
export const FONT_FIX_RE =
  /font|글꼴|폰트|typography|타이포그래피|font-family|fontFamily|글꼴\s*(적용|안\s*먹|수정|고)|폰트\s*(적용|안\s*먹|수정|고)/i;

/** Hero/CTA text-only scope — not a layout job */
export const NARROW_UI_RE =
  /히어로\s*(섹션\s*)?(문구|텍스트|영어|슬로건|카피)\s*만|cta\s*(텍스트|문구)\s*만|hero\s*(section\s*)?(text|copy|slogan)\s*only|랜딩\s*문구\s*만|히어로\s*영어|영어\s*슬로건/i;

/** Short fix verbs + tiny UI scope */
export const NARROW_FIX_RE =
  /(?:수정|고쳐|적용|바꿔|fix|change).{0,24}(?:font|폰트|글꼴|문구|슬로건|영어|i18n|카피|cta)|(?:font|폰트|글꼴).{0,24}(?:수정|고쳐|적용|안\s*먹|fix|apply)/i;

/** Dashboard / layout refactor — Fable-tier multi-file UI */
export const UI_LAYOUT_REFACTOR_RE =
  /레이아웃\s*리팩터|layout\s*refactor|대시보드\s*레이아웃\s*(?:리팩터|개편|구조)|ui\s*리팩터|컴포넌트\s*구조\s*(변경|리팩터)|멀티\s*파일\s*ui|화면\s*구조\s*개편|design\s*system\s*정리/i;

const TINY_SCOPE_RE =
  /한\s*줄|one[- ]?line|i18n|타이포|typo|문구\s*만|주석\s*만|lint\s*만|퀵\s*(픽스|패치)|hot\s*fix|카피\s*한\s*줄|작은\s*(수정|패치)/i;

/** Short follow-up in same chat — treat as light tier (no keep on Fable/Codex) */
export const FOLLOW_UP_LIGHT_RE =
  /여기도\s*(고|수정|바꿔|해)?|이것도|거기도|마저|문구\s*만|카피\s*만|타이포\s*만|간단\s*(히|하게)?|짧게|후속\s*(명령|작업)?/i;

export function isLightPatchCommand(
  signals: CommandSignals,
  text: string,
): boolean {
  return (
    signals.copy_only ||
    signals.light_ui_copy ||
    signals.scope === "tiny" ||
    FOLLOW_UP_LIGHT_RE.test(text ?? "")
  );
}

function modelTierRank(tier: ModelTier): number {
  if (tier === "low") return 0;
  if (tier === "mid") return 1;
  return 2;
}

/** Sticky was heavy; new command is lighter — never keep expensive model */
export function shouldForceTierSwitch(
  current: ModelId,
  primary: ModelId,
  signals: CommandSignals,
  text: string,
): boolean {
  if (current === primary) return false;
  const down =
    modelTierRank(MODEL_TIER[current]) > modelTierRank(MODEL_TIER[primary]);
  if (down && isLightPatchCommand(signals, text)) return true;
  if (down && signals.scope === "tiny") return true;
  if (
    current !== LIGHTEST_LOGICAL &&
    primary === LIGHTEST_LOGICAL &&
    isLightPatchCommand(signals, text)
  ) {
    return true;
  }
  return false;
}

export function isCopyOnlyTask(text: string): boolean {
  return COPY_ONLY_RE.test(text ?? "");
}

/** Hero copy / font apply / narrow CTA — Composer even when UI keywords present */
export function isLightUiCopyOrFontTask(text: string, tags: Tag[] = []): boolean {
  const t = text ?? "";
  if (isCopyOnlyTask(t)) return true;
  if (UI_LAYOUT_REFACTOR_RE.test(t) || LARGE_UI_RE.test(t)) return false;
  if (NARROW_UI_RE.test(t)) return true;
  if (LIGHT_COPY_RE.test(t) && !/(리팩터|refactor|레이아웃|layout|전면|멀티|design\s*system)/i.test(t)) {
    return true;
  }
  if (
    FONT_FIX_RE.test(t) &&
    !/(리팩터|refactor|레이아웃|layout|전면|멀티|design\s*system|컴포넌트\s*구조)/i.test(t)
  ) {
    return true;
  }
  if (NARROW_FIX_RE.test(t)) return true;
  if (
    /히어로|hero/i.test(t) &&
    (LIGHT_COPY_RE.test(t) || FONT_FIX_RE.test(t) || COPY_ONLY_RE.test(t)) &&
    /(수정|고쳐|적용|바꿔|change|fix)/i.test(t) &&
    !/(리팩터|refactor|레이아웃|layout|전면|멀티)/i.test(t)
  ) {
    return true;
  }
  void tags;
  return false;
}

/** Multi-file / layout UI refactor — keep Fable tier */
export function isUiLayoutRefactorTask(text: string, tags: Tag[] = []): boolean {
  const t = text ?? "";
  if (isLightUiCopyOrFontTask(t, tags)) return false;
  return (
    UI_LAYOUT_REFACTOR_RE.test(t) ||
    (tags.includes("ui") &&
      /리팩터|refactor|멀티\s*파일|컴포넌트\s*구조|design\s*system|화면\s*구조\s*개편|레이아웃\s*(?:리팩터|개편|구조)|layout\s*refactor/i.test(
        t,
      ))
  );
}

/** Light / copy / tiny — prefer Standard tier in chat UI (not Fast) */
export function prefersStandardUi(signals: CommandSignals): boolean {
  return (
    signals.copy_only ||
    signals.light_ui_copy ||
    signals.scope === "tiny" ||
    (signals.scope === "local" &&
      !signals.hard_bug &&
      !signals.large_ui &&
      !signals.ui_layout_refactor &&
      !signals.architecture)
  );
}

/** Standard chat slug when verified; null if UI-only (e.g. Grok 4.6 — turn Fast off in picker) */
export function standardUiSlug(primary: ModelId): string | null {
  return CURSOR_STANDARD_SLUG[primary] ?? null;
}

export function buildUiRecommendation(
  primary: ModelId,
  primary_id: string,
  signals: CommandSignals,
): { ui_recommended_id?: string; ui_recommended_note?: UsageEstimate } {
  if (!prefersStandardUi(signals)) return {};
  const standard = standardUiSlug(primary);
  if (primary === LIGHTEST_LOGICAL && standard && primary_id.endsWith("-fast")) {
    return {
      ui_recommended_id: standard,
      ui_recommended_note: {
        ko: "간단 작업 → 채팅 UI에서 Composer 2.5 Standard(Fast 끄기). Task slug는 composer-2.5-fast fallback",
        en: "Light work → chat UI Composer 2.5 Standard (Fast off). Task slug stays composer-2.5-fast fallback",
      },
    };
  }
  if (primary === "Grok 5.x" && primary_id.includes("-fast")) {
    return {
      ui_recommended_note: {
        ko: "Grok 4.6 — 채팅 UI에서 Fast 끄고 Standard(High) 선택 (Task는 high-fast만 노출될 수 있음)",
        en: "Grok 4.6 — chat UI: turn Fast off, pick Standard (High); Task may only expose high-fast",
      },
    };
  }
  return {};
}

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
  /** i18n/copy/typo — host lightest tier, not Sonnet/Fable */
  copy_only: boolean;
  /** Long codebase read / code-heavy context — Kimi tier */
  long_code_context: boolean;
  /** Hero slogan / font apply / narrow CTA — Composer wins over UI tag */
  light_ui_copy: boolean;
  /** Dashboard layout refactor / multi-file UI — Fable tier */
  ui_layout_refactor: boolean;
  /** Prior turns drove copy/layout classification */
  context_informed: boolean;
  /** Short task with no context — conservative Composer */
  ambiguous_short: boolean;
  /** One-line WHY for reason field */
  why: string;
}

export interface AnalyzeCommandOpts {
  /** Current turn only — length / ambiguous-short detection */
  taskText?: string;
  hasContext?: boolean;
}

export function analyzeCommand(
  text: string,
  tags: Tag[] = [],
  opts?: AnalyzeCommandOpts,
): CommandSignals {
  const t = text ?? "";
  const taskOnly = (opts?.taskText ?? text ?? "").trim();
  const char_len = taskOnly.length;
  const hasContext = !!opts?.hasContext;
  const hard_bug = isHardBugTask(t, tags);
  const ui = isUiTask(t, tags);
  const architecture =
    tags.includes("architecture") ||
    /설계|구조|아키텍처|트레이드.?오프|기술\s*선택|의사결정|기획|계획/i.test(t);
  const implementation = isImplementationTask(t);
  const copy_only = isCopyOnlyTask(t);
  const long_code_context = isLongCodeContextTask(t, tags);
  const light_ui_copy =
    isLightUiCopyOrFontTask(t, tags) &&
    (LIGHT_COPY_RE.test(t) ||
      FONT_FIX_RE.test(t) ||
      NARROW_UI_RE.test(t) ||
      NARROW_FIX_RE.test(t) ||
      (/히어로|hero/i.test(t) &&
        /(수정|고쳐|적용|바꿔|change|fix)/i.test(t)));
  const ui_layout_refactor = isUiLayoutRefactorTask(t, tags);
  const follow_up_light =
    FOLLOW_UP_LIGHT_RE.test(t) && !hard_bug && !architecture;
  const large_ui =
    ui &&
    !light_ui_copy &&
    (LARGE_UI_RE.test(t) || (BROAD_SCOPE_RE.test(t) && ui));

  let budget: CommandBudget = "neutral";
  if (PREMIUM_BUDGET_RE.test(t)) budget = "premium";
  else if (SAVE_BUDGET_RE.test(t)) budget = "save";

  let scope: CommandScope = "local";
  if (TINY_SCOPE_RE.test(t) || follow_up_light || light_ui_copy) scope = "tiny";
  else if (/수천|수백\s*파일|entire\s*codebase|whole\s*codebase/i.test(t))
    scope = "huge";
  else if (BROAD_SCOPE_RE.test(t) || char_len > 160) scope = "broad";
  else if (char_len < 18 && !ui && !hard_bug && !architecture && !hasContext)
    scope = "tiny";

  const taskOnlyLight =
    isLightUiCopyOrFontTask(taskOnly, tags) ||
    isCopyOnlyTask(taskOnly) ||
    isUiLayoutRefactorTask(taskOnly, tags);
  const classifyLight =
    isLightUiCopyOrFontTask(t, tags) ||
    isCopyOnlyTask(t) ||
    isUiLayoutRefactorTask(t, tags);
  const context_informed =
    hasContext && classifyLight && !taskOnlyLight;
  const ambiguous_short =
    !hasContext &&
    char_len > 0 &&
    char_len < 16 &&
    !hard_bug &&
    !architecture &&
    !ui_layout_refactor &&
    !large_ui &&
    !copy_only &&
    !light_ui_copy;

  let why: string;
  if (budget === "premium") {
    why = "명령에 최고품질/프리미엄 명시 → 절약 해제";
  } else if (hard_bug) {
    why = "난해 버그·CI·재현 → Terra/Codex급 필요";
  } else if (architecture && !ui && !implementation) {
    why = "설계·기획·트레이드오프 → Fable/Grok/Opus/Sonnet 경쟁";
  } else if (architecture && implementation) {
    why = "설계+구현 혼합 → 구현 신호 우선(Composer/UI면 Fable)";
  } else if (context_informed && light_ui_copy) {
    why = "대화 문맥(히어로·폰트·슬로건) → Composer — 이번 턴 키워드 없어도 light tier";
  } else if (context_informed && ui_layout_refactor) {
    why = "대화 문맥(레이아웃·리팩터) → Fable — 이번 턴 키워드 없어도 UI refactor";
  } else if (context_informed && copy_only) {
    why = "대화 문맥(i18n·카피) → Composer lightest";
  } else if (ambiguous_short) {
    why = "짧은 요청·문맥 없음 → 보수적으로 Composer";
  } else if (ui_layout_refactor) {
    why = "레이아웃·멀티파일 UI 리팩터 → Fable";
  } else if (large_ui) {
    why = "넓은 UI 리디자인 → Fable 에스컬레이션";
  } else if (long_code_context) {
    why = "긴 코드 컨텍스트·대형 리포 분석 → Kimi (설계/기획 아님)";
  } else if (copy_only) {
    why = "문구/i18n/타이포 → 호스트 lightest (Cursor=Composer, Claude=Haiku, GPT=Mini)";
  } else if (light_ui_copy) {
    why = "히어로 문구·폰트·슬로건 → Composer (UI 키워드만으로 Fable/Sonnet 금지)";
  } else if (follow_up_light || scope === "tiny" || TINY_SCOPE_RE.test(t)) {
    why = "짧은 후속·작은 패치 → lightest tier (호스트별 id)";
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
    copy_only,
    long_code_context,
    light_ui_copy,
    ui_layout_refactor,
    context_informed,
    ambiguous_short,
    why,
  };
}

function isCheapBias(cfg?: ProjectConfig): boolean {
  return effectiveSaveBias(cfg);
}

/** Merge blocked_models + unavailable_models + enabled_models whitelist into a Set of ModelId */
export function unavailableSet(cfg?: ProjectConfig): Set<ModelId> {
  const blocked = new Set<ModelId>();
  const raw = [
    ...(cfg?.blocked_models ?? []),
    ...(cfg?.unavailable_models ?? []),
  ];
  for (const m of raw) {
    const id = resolveModelId(m);
    if (id) blocked.add(id);
  }
  if (cfg?.enabled_models?.length) {
    const enabled = new Set<ModelId>();
    for (const m of cfg.enabled_models) {
      const id = resolveModelId(m);
      if (id) enabled.add(id);
    }
    for (const m of MODELS) {
      if (!enabled.has(m)) blocked.add(m);
    }
  }
  return blocked;
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
  } else if (primary === "Opus 5") {
    candidates = ["Fable 5", "Grok 5.x", "Claude Sonnet", "Composer 2.5"];
  } else if (primary === "Claude Sonnet") {
    candidates = ["Composer 2.5"];
  } else if (primary === "Grok 5.x") {
    candidates = ["Fable 5", "Claude Sonnet", "Composer 2.5"];
  } else if (primary === "Kimi K2.7") {
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
  host: string,
): UsageEstimate {
  const heavy = primary === "GPT-5 Codex" || primary === "Grok 5.x";
  const light = primary === LIGHTEST_LOGICAL;
  const midClaude =
    primary === "Claude Sonnet" ||
    primary === "Claude Opus" ||
    primary === "Fable 5";

  if (
    light &&
    (signals.copy_only ||
      signals.light_ui_copy ||
      signals.scope === "tiny" ||
      signals.scope === "local")
  ) {
    const label = hostLightestLabel(host);
    const standardHint =
      host === "cursor" || resolveHostId(host) === "cursor"
        ? " — Composer 2.5 **Standard**(Fast 아님, ≈6× 저렴)"
        : "";
    if (signals.light_ui_copy) {
      return {
        ko: `히어로 문구·폰트·슬로건 → lightest (${label})${standardHint} — Fable/Sonnet/Codex는 과함`,
        en: `Hero copy/font/slogan → lightest (${label})${standardHint.replace("Standard", "Standard tier")} — Fable/Sonnet/Codex overkill`,
      };
    }
    if (signals.copy_only) {
      return {
        ko: `문구/i18n/타이포 → lightest (${label})${standardHint} — Sonnet/Fable/Codex는 과함`,
        en: `Copy/i18n/typo → lightest (${label})${standardHint.replace("Standard", "Standard tier")} — Sonnet/Fable/Codex overkill`,
      };
    }
    return {
      ko: `작은 패치 → lightest tier${standardHint} — Codex·Fable·Fast는 과함`,
      en: `Small patch → lightest tier${standardHint} — Codex/Fable/Fast overkill`,
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
  if (
    primary === "Fable 5" &&
    (signals.large_ui || signals.ui_layout_refactor)
  ) {
    return {
      ko: signals.ui_layout_refactor
        ? "레이아웃·멀티파일 UI 리팩터에 Fable 적합 — 히어로 문구·폰트만이면 Composer"
        : "넓은 UI엔 Fable 적합 — 작은 패치면 Composer/Sonnet",
      en: signals.ui_layout_refactor
        ? "Fable fits layout/multi-file UI refactor — hero copy/font only → Composer"
        : "Fable fits broad UI — Composer/Sonnet for small patches",
    };
  }
  if (primary === "Fable 5") {
    return {
      ko: "UI·멀티파일에 Fable 적합 — 히어로 문구·폰트·i18n은 Composer",
      en: "Fable fits UI/multi-file — hero copy/font/i18n → Composer",
    };
  }
  if (primary === "Grok 5.x") {
    return {
      ko: "Grok 4.6 적합 — 넓은 설계·장기 에이전트; 일상 패치·UI는 Composer/Sonnet",
      en: "Grok 4.6 fits broad design / long agents; daily patches & UI → Composer/Sonnet",
    };
  }
  if (primary === "Opus 5") {
    return {
      ko: "Opus 5 — 초대형·최고 난이도만. 평소 Sonnet/Fable/Grok 우선",
      en: "Opus 5 — extreme scope only. Prefer Sonnet/Fable/Grok normally",
    };
  }
  if (primary === "Kimi K2.7") {
    return {
      ko: "Kimi K2.7 — 긴 코드 컨텍스트·대형 리포. 짧은 패치는 Composer",
      en: "Kimi K2.7 — long code context / large repo. Short patches → Composer",
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
  host?: string,
): CostPreview {
  return {
    weight: costTierToWeight(primaryCostTier),
    relative: { ...RELATIVE_COST[primary] },
    advice: buildCostAdvice(primary, signals, preferCheaper, host ?? "cursor"),
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
      scores["Opus 5"] -= 8;
    }
  } else if (isQualityBias(cfg)) {
    scores["GPT-5 Codex"] += 8;
    scores["Grok 5.x"] += 6;
    scores["Fable 5"] += 4;
    scores["Claude Opus"] += 4;
    scores["Opus 5"] += 3;
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
  const merged = mergeTaskContext({
    task_description: input.task_description ?? "",
    conversation_context: input.conversation_context,
    recent_turns: input.recent_turns,
  });
  const text = merged.classifyText;
  const taskText = merged.task;
  const tags = input.tags ?? [];
  const cfg = input.project_config;
  const hostRaw = input.host ?? cfg?.preferred_host;
  const host = resolveHostId(hostRaw);
  const signals = analyzeCommand(text, tags, {
    taskText,
    hasContext: merged.hasContext,
  });
  const token_risk = estimateTokenRisk(text, tags);
  const hardBug = signals.hard_bug;
  const uiTask = signals.ui;
  const blocked = unavailableSet(cfg);
  const scores: Record<ModelId, number> = { ...BASE };

  for (const tag of tags) {
    if (tag === "ui" && signals.light_ui_copy) continue;
    const boost = TAG_BOOST[tag];
    if (boost) addScores(scores, boost);
  }
  for (const rule of KEYWORD_RULES) {
    if (!rule.re.test(text)) continue;
    if (
      signals.light_ui_copy &&
      /ui|ux|디자인|화면|레이아웃|프론트|css|스타일|컴포넌트|랜딩|히어로/i.test(
        rule.re.source,
      )
    ) {
      continue;
    }
    addScores(scores, rule.boost);
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

  // Default save + normal UI: Sonnet over Fable (unless large redesign / layout refactor / light copy)
  if (
    prefer_cheaper &&
    uiTask &&
    !hardBug &&
    !signals.large_ui &&
    !signals.light_ui_copy &&
    !signals.ui_layout_refactor
  ) {
    scores["Claude Sonnet"] += 40;
    scores["Fable 5"] -= 25;
    scores["Composer 2.5"] += 8;
  }

  // Layout refactor / multi-file UI → Fable
  if (signals.ui_layout_refactor && !hardBug) {
    scores["Fable 5"] += 55;
    scores["Claude Sonnet"] += 8;
    scores["Composer 2.5"] -= 12;
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
      scores["Grok 5.x"] += 14;
      scores["Fable 5"] += 10;
      scores["Opus 5"] += 12;
      scores["Claude Opus"] += 6;
    }
    if (prefer_cheaper && signals.budget !== "premium") {
      scores["Claude Sonnet"] += 8;
      scores["Grok 5.x"] += 2;
      scores["Opus 5"] -= 10;
    }
  }

  // Long code context — Kimi competes with Sonnet (not light copy / layout refactor)
  if (
    signals.long_code_context &&
    !hardBug &&
    !signals.ui_layout_refactor &&
    !blocked.has("Kimi K2.7")
  ) {
    scores["Kimi K2.7"] += 55;
    scores["Claude Sonnet"] += 10;
    scores["Fable 5"] -= 20;
    scores["Composer 2.5"] -= 25;
    scores["Grok 5.x"] -= 8;
  }

  // Extreme difficulty — Opus 5 rarely (premium or explicit)
  if (
    !hardBug &&
    !blocked.has("Opus 5") &&
    (signals.budget === "premium" ||
      /최고\s*난이도|초대형|극한|opus\s*5|오퍼스\s*5|maximum\s*effort|hardest/i.test(
        text,
      )) &&
    (signals.scope === "huge" || signals.scope === "broad" || signals.architecture)
  ) {
    scores["Opus 5"] += 45;
    scores["Fable 5"] += 5;
    scores["Composer 2.5"] -= 20;
  }

  // Copy/i18n/typo / hero slogan / font apply → host lightest logical role
  if (
    (signals.copy_only || signals.light_ui_copy) &&
    !hardBug &&
    !blocked.has(LIGHTEST_LOGICAL)
  ) {
    scores[LIGHTEST_LOGICAL] += signals.light_ui_copy ? 65 : 40;
    scores["Fable 5"] -= signals.light_ui_copy ? 35 : 12;
    scores["Claude Sonnet"] -= signals.light_ui_copy ? 30 : 0;
    scores["GPT-5 Codex"] -= 10;
  }

  // Short request without context — conservative Composer
  if (signals.ambiguous_short && !hardBug && !blocked.has(LIGHTEST_LOGICAL)) {
    scores[LIGHTEST_LOGICAL] += 40;
    scores["Fable 5"] -= 25;
    scores["Claude Sonnet"] -= 20;
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

  if (
    (signals.copy_only || signals.light_ui_copy || signals.ambiguous_short) &&
    !hardBug &&
    !blocked.has(LIGHTEST_LOGICAL)
  ) {
    if (primary !== LIGHTEST_LOGICAL) {
      alternative = primary;
      primary = LIGHTEST_LOGICAL;
    }
  }

  // Escalation overrides (command clearly needs it)
  if (hardBug) {
    const bugPrimary: ModelId | undefined = (
      ["GPT-5 Codex", "GPT-5 Sol", "Claude Sonnet", "Composer 2.5"] as ModelId[]
    ).find((m) => !blocked.has(m));
    if (bugPrimary && primary !== bugPrimary) {
      alternative = primary === bugPrimary ? alternative : primary;
      primary = bugPrimary;
    }
  } else if (
    signals.long_code_context &&
    !hardBug &&
    !blocked.has("Kimi K2.7")
  ) {
    if (primary !== "Kimi K2.7") {
      alternative = primary;
      primary = "Kimi K2.7";
    }
  } else if (
    (signals.ui_layout_refactor || signals.large_ui) &&
    !hardBug &&
    !blocked.has("Fable 5")
  ) {
    if (primary !== "Fable 5") {
      alternative = primary;
      primary = "Fable 5";
    }
  } else if (prefer_cheaper) {
    // UI quality-cheap: Sonnet (or Composer if Sonnet blocked)
    if (
      uiTask &&
      !hardBug &&
      !signals.large_ui &&
      !signals.ui_layout_refactor &&
      !signals.light_ui_copy
    ) {
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
    isDesignHandoffModel(currentResolved) &&
    signals.implementation &&
    !signals.large_ui;

  if (designToImpl) {
    // Save gate: design done → build with Sonnet (not Fable). Verbal "페이블로" overrides later.
    const implPrimary: ModelId = blocked.has("Claude Sonnet")
      ? "Composer 2.5"
      : "Claude Sonnet";
    if (primary !== implPrimary && !blocked.has(implPrimary)) {
      alternative = primary;
      primary = implPrimary;
    }
  } else if (signals.architecture && signals.implementation && !hardBug) {
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

  const verbal = detectVerbalModelRequest(taskText);
  let verbalApplied = false;
  let verbalUnavailable = false;
  if (verbal) {
    const verbalAvailable =
      !blocked.has(verbal.model) &&
      isHostModelAvailable(host, verbal.model, blocked);
    if (verbalAvailable) {
      if (primary !== verbal.model) {
        alternative = primary;
        primary = verbal.model;
      }
      verbalApplied = true;
    } else {
      verbalUnavailable = true;
      const ranked = [...MODELS].sort((a, b) => scores[b] - scores[a]);
      const next = ranked.find(
        (m) => m !== verbal.model && !blocked.has(m) && isHostModelAvailable(host, m, blocked),
      );
      if (next && primary !== next) {
        alternative = primary === next ? alternative : primary;
        primary = next;
      }
    }
    [primary, alternative] = ensureNotBlocked(primary, alternative, scores, cfg, {
      hardBug,
    });
  }

  const fbOpts = { hardBug, unavailable: blocked };
  const cheaper_fallback = pickCheaperFallback(primary, fbOpts);
  const cheaper_fallback_slug = cheaper_fallback.slug;
  const candidates = buildCandidates(primary, alternative, host, fbOpts);
  const fallback_chain = candidates.map((c) => c.slug || c.id);

  let stick_action: "keep" | "switch" | undefined;
  let tier_switch = false;
  if (currentResolved != null) {
    tier_switch = shouldForceTierSwitch(
      currentResolved,
      primary,
      signals,
      taskText,
    );
    if (designToImpl || tier_switch) {
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
  if (verbalApplied && verbal) {
    reason = `주인님 말 지정: ${verbal.label} → ${primary} · ${reason}`;
  } else if (verbalUnavailable && verbal) {
    reason = `말 지정 but unavailable · ${verbal.label} 요청 · ${reason}`;
  }
  if (stick_action === "keep") {
    reason = `모델 유지 · ${reason}`;
  } else if (stick_action === "switch") {
    reason = tier_switch
      ? `작업 경량화 → ${primary}로 전환 · ${reason}`
      : `${primary}로 전환 · ${reason}`;
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
  const uiRec = buildUiRecommendation(primary, primary_id, signals);

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
      host,
    ),
    honest_limit: { ko: "", en: "" },
    ...uiRec,
    ...(verbal
      ? {
          verbal_override: {
            requested: verbal.model,
            label: verbal.label,
            applied: verbalApplied,
            ...(verbalApplied ? { one_shot: true as const } : {}),
          },
        }
      : {}),
    ...(merged.hasContext
      ? {
          context_meta: {
            has_context: true,
            context_informed: signals.context_informed,
            ambiguous_short: signals.ambiguous_short,
          },
        }
      : {}),
    ...(tier_switch ? { tier_switch: true as const } : {}),
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
    verbal_override,
  } = result;
  const weightKo =
    cost_preview.weight === "light"
      ? "가벼움"
      : cost_preview.weight === "heavy"
        ? "무거움"
        : "보통";
  const persistKo = model_persistence ? ` ${model_persistence.ko}.` : "";
  const persistEn = model_persistence ? ` ${model_persistence.en}.` : "";
  const verbalKo =
    verbal_override?.applied
      ? ` 주인님 말 지정: ${verbal_override.label}.`
      : verbal_override && !verbal_override.applied
        ? ` 말 지정(${verbal_override.label}) 불가 → 점수 기반.`
        : "";
  const verbalEn =
    verbal_override?.applied
      ? ` Verbal override: ${verbal_override.label}.`
      : verbal_override && !verbal_override.applied
        ? ` Verbal ${verbal_override.label} unavailable → scored fallback.`
        : "";
  return {
    for_task: {
      primary,
      primary_id,
      cost_tier: primary_cost_tier,
    },
    clarity: {
      ko: `작업용 추천: ${primary} (${primary_id}, ${weightKo}).${verbalKo} ${cost_preview.advice.ko}.${persistKo} MCP 호출 모델과 별개.`,
      en: `Task recommendation: ${primary} (${primary_id}, ${cost_preview.weight}).${verbalEn} ${cost_preview.advice.en}.${persistEn} Separate from MCP caller.`,
    },
    cost_preview,
    honest_limit: {
      ko: "Cursor UI 모델은 자동 전환되지 않습니다. MCP를 호출한 에이전트/워커(예: Composer)와 작업용 추천(primary)은 다를 수 있습니다.",
      en: "Cursor does not auto-switch the chat model. The agent/worker that called this MCP (e.g. Composer) may differ from the task recommendation (primary).",
    },
  };
}

/** Task worker hint — copy this slug onto Task.model (MCP cannot auto-bind). */
export function buildRunHint(result: RecommendResult): {
  ko: string;
  en: string;
  task_model: string;
  fallback_model: string;
  task_model_required: true;
  ui_model?: string;
} {
  const fb =
    result.candidates[1]?.id ??
    result.candidates[1]?.slug ??
    result.cheaper_fallback_slug;
  const ui = result.ui_recommended_id;
  const uiKo = ui
    ? `채팅 UI=${ui}(Standard, Fast 아님) · `
    : result.ui_recommended_note?.ko
      ? `${result.ui_recommended_note.ko} · `
      : "";
  const uiEn = ui
    ? `chat UI=${ui} (Standard, not Fast) · `
    : result.ui_recommended_note?.en
      ? `${result.ui_recommended_note.en} · `
      : "";
  const stickyKo = result.verbal_override?.one_shot
    ? "set_sticky 생략(one-shot)"
    : result.tier_switch
      ? `set_sticky=${result.primary_id}`
      : "set_sticky";
  return {
    task_model: result.primary_id,
    fallback_model: fb,
    task_model_required: true,
    ...(ui ? { ui_model: ui } : {}),
    ko: `${uiKo}Task.model=${result.primary_id} 필수(말만 switch=위반; 불가 시 ${fb}) → log_model_usage → ${stickyKo}`,
    en: `${uiEn}Task.model=${result.primary_id} required (talk-only switch=violation; if unavailable ${fb}) → log_model_usage → ${stickyKo.replace("생략", "skip")}`,
  };
}

const AGENT_NOTE = {
  ko: "Task.model=must_do.task_model(copy_task_model) 필수. model 생략=Composer 잔류=위반. 「추천으로 다시」도 그 slug로 재실행. Multitask 부모도 동일. unavailable → candidates[1].id. 주인님껀 sticky 단어 금지 — model_persistence.",
  en: "Task.model=must_do.task_model (copy_task_model) required. Omitting model leaves Composer = violation. Talk-only switch also requires that slug. Multitask parent must pass it too. If unavailable → candidates[1].id. Never say sticky to user — use model_persistence.",
} as const;

/** Token-minimal gate payload for start_session (not recommend_model). */
export function compactGateRecommend(
  result: RecommendResult,
): Record<string, unknown> {
  const { cost_preview } = buildRecommendClarity(result);
  const must_do = buildMustDo(result);
  const run_hint = buildRunHint(result);
  return {
    primary_id: result.primary_id,
    copy_task_model: result.primary_id,
    must_do: {
      task_model: must_do.task_model,
      fallback_model: must_do.fallback_model,
      task_model_required: true,
    },
    stick_action: result.stick_action ?? null,
    model_persistence: result.model_persistence?.ko ?? null,
    cost_advice: cost_preview.advice.ko,
    run_hint: run_hint.ko,
    ...(result.context_meta?.context_informed
      ? { context_informed: true }
      : {}),
    ...(result.tier_switch ? { tier_switch: true } : {}),
    ...(result.verbal_override?.one_shot ? { verbal_one_shot: true } : {}),
    ...(result.ui_recommended_id
      ? { ui_recommended_id: result.ui_recommended_id }
      : {}),
  };
}

/** Compact tool payload — default for agents (token-light) */
export function compactRecommendResult(
  result: RecommendResult,
  opts?: { mcp_version?: string },
): Record<string, unknown> {
  const { for_task, clarity, cost_preview, honest_limit } =
    buildRecommendClarity(result);
  const run_hint = buildRunHint(result);
  const must_do = buildMustDo(result);
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
    mcp_version: opts?.mcp_version ?? null,
    copy_task_model: result.primary_id,
    run_hint,
    must_do,
    agent_note: AGENT_NOTE,
    ...(result.ui_recommended_id
      ? { ui_recommended_id: result.ui_recommended_id }
      : {}),
    ...(result.ui_recommended_note
      ? { ui_recommended_note: result.ui_recommended_note }
      : {}),
    ...(result.stick_action
      ? {
          stick_action: result.stick_action,
          model_persistence: result.model_persistence,
          sticky_suggest: result.sticky_suggest,
        }
      : {}),
  };
}
