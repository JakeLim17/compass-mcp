/**
 * ChronoCode model scoring SSOT.
 * Claude ladder (approx cost): Composer < Sonnet < Opus < Fable/Codex
 * Output names: Composer 2.5 / Claude Sonnet / Claude Opus / Fable 5 / Grok 5.x / GPT-5 Codex
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
  | "GPT-5 Codex";

/** Relative cost/weight — not dollar amounts */
export type CostTier = "low" | "medium" | "medium-high" | "high";

/**
 * Coarse model tier (docs / vibe-coding pick):
 * low = Composer · mid = Sonnet/Opus/Fable/Grok · high = Codex
 */
export type ModelTier = "low" | "mid" | "high";

/** Estimated context/token burn for this task (not $) */
export type TokenRisk = "low" | "medium" | "high";

export type Tag = "ui" | "bug" | "architecture" | "test";

export interface UsageEstimate {
  en: string;
  ko: string;
}

/** Approx Claude family ladder (lowest → highest). Fable ≈ top Claude UI; Codex peers at top. */
export const CLAUDE_COST_LADDER: ModelId[] = [
  "Composer 2.5",
  "Claude Sonnet",
  "Claude Opus",
  "Fable 5",
  "GPT-5 Codex",
];

export const CLAUDE_LADDER_DOC =
  "Composer < Sonnet < Opus < Fable/Codex (approx relative cost; Grok is design-mid, not on Claude ladder)";

/** Relative cost map */
export const COST_TIER: Record<ModelId, CostTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "medium",
  "Claude Opus": "medium-high",
  "Fable 5": "medium-high",
  "Grok 5.x": "medium-high",
  "GPT-5 Codex": "high",
};

/** Coarse tier */
export const MODEL_TIER: Record<ModelId, ModelTier> = {
  "Composer 2.5": "low",
  "Claude Sonnet": "mid",
  "Claude Opus": "mid",
  "Fable 5": "mid",
  "Grok 5.x": "mid",
  "GPT-5 Codex": "high",
};

const USAGE_ESTIMATE: Record<ModelId, UsageEstimate> = {
  "Composer 2.5": {
    en: "light daily loop — prefer for small patches / bulk mechanical",
    ko: "가벼운 일상 루프 — 작은 수정·대량 기계 작업에 적합",
  },
  "Claude Sonnet": {
    en: "cheaper Claude mid — quality without Fable/Codex burn",
    ko: "저가 Claude mid — Fable/Codex보다 싸게 품질 유지",
  },
  "Claude Opus": {
    en: "stronger Claude than Sonnet — still often cheaper/different from Fable",
    ko: "Sonnet보다 강한 Claude — Fable과 다른 축·종종 더 저렴",
  },
  "Fable 5": {
    en: "mid-weight multi-file / UI job (Cursor high Claude)",
    ko: "중간 무게 멀티파일·UI 작업 (Cursor 고가 Claude)",
  },
  "Grok 5.x": {
    en: "heavier design/reasoning — design only, then hand off",
    ko: "무거운 설계·추론 — 설계만 하고 구현은 넘김",
  },
  "GPT-5 Codex": {
    en: "heavier reasoning job — prefer when stuck on CI/bugs",
    ko: "무거운 추론 — CI·난해한 버그에 막혔을 때",
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
  "GPT-5 Codex": "gpt-5.6-sol-medium",
};

const SLUG_TO_MODEL: Record<string, ModelId> = Object.fromEntries(
  (Object.entries(CURSOR_TASK_SLUG) as [ModelId, string][]).map(([id, slug]) => [
    slug,
    id,
  ]),
) as Record<string, ModelId>;

/** 표시명·slug·약칭 → ModelId (모르면 null) */
export function resolveModelId(raw?: string | null): ModelId | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if ((MODELS as string[]).includes(s)) return s as ModelId;
  if (SLUG_TO_MODEL[s]) return SLUG_TO_MODEL[s];
  const lower = s.toLowerCase();
  if (lower.includes("composer")) return "Composer 2.5";
  if (lower.includes("sonnet")) return "Claude Sonnet";
  if (lower.includes("opus")) return "Claude Opus";
  if (lower.includes("fable")) return "Fable 5";
  if (lower.includes("grok")) return "Grok 5.x";
  if (lower.includes("codex") || lower.includes("gpt-5")) return "GPT-5 Codex";
  if (lower.startsWith("role:")) {
    if (lower.includes("light") || lower.includes("cheap")) return "Composer 2.5";
    if (lower.includes("sonnet")) return "Claude Sonnet";
    if (lower.includes("opus")) return "Claude Opus";
    if (lower.includes("mid") || lower.includes("ui")) return "Fable 5";
    if (lower.includes("design")) return "Grok 5.x";
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
  /** Coarse tier: low=Composer mid=Sonnet/Opus/Fable/Grok high=Codex */
  primary_tier: ModelTier;
  alternative_tier: ModelTier;
  /** Estimated token/context burn for this task */
  token_risk: TokenRisk;
  /**
   * true when token_risk=high, cost_bias cheap, or usage alerts:
   * bulk → Composer; UI quality-cheap → Sonnet; hard bug → Codex + Sonnet fallback
   */
  prefer_cheaper: boolean;
  /**
   * Always present: step-down on Claude ladder (or Composer when already cheapest).
   * Agents: when prefer_cheaper, prefer Task model=cheaper_fallback_slug (or Sonnet).
   */
  cheaper_fallback: CheaperFallback;
  cheaper_fallback_slug: string;
  /** Short EN+KO hint about when this weight is worth it */
  usage_estimate: UsageEstimate;
  /** Idempotent-ish id for feedback_recommendation */
  recommendation_id: string;
  /** current_model 있을 때: keep = 그대로 / switch = 전환 제안 */
  stick_action?: "keep" | "switch";
  current_resolved?: ModelId | null;
  /** When keep: soft hint to stay quiet */
  sticky_suggest?: "keep_silent";
}

const MODELS: ModelId[] = [
  "Composer 2.5",
  "Claude Sonnet",
  "Claude Opus",
  "Fable 5",
  "Grok 5.x",
  "GPT-5 Codex",
];

/** 기본 비중 반영 베이스 점수 */
const BASE: Record<ModelId, number> = {
  "Composer 2.5": 40,
  "Claude Sonnet": 12,
  "Claude Opus": 6,
  "Fable 5": 15,
  "Grok 5.x": 8,
  "GPT-5 Codex": 5,
};

const TAG_BOOST: Record<Tag, Partial<Record<ModelId, number>>> = {
  ui: { "Fable 5": 35, "Claude Sonnet": 8, "Composer 2.5": 5 },
  // Codex must beat Composer BASE(40) even without keyword matches
  bug: { "GPT-5 Codex": 50, "Claude Sonnet": 8, "Composer 2.5": 5 },
  architecture: { "Grok 5.x": 45, "Fable 5": 10, "Claude Opus": 5 },
  test: { "GPT-5 Codex": 50, "Claude Sonnet": 8, "Composer 2.5": 5 },
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
    boost: { "GPT-5 Codex": 35, "Claude Sonnet": 8, "Composer 2.5": 10 },
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

/** Hard debug / CI — keep Codex even when tokens are high */
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

function isCheapBias(cfg?: ProjectConfig): boolean {
  const b = cfg?.cost_bias;
  return (
    b === "prefer_cheaper" ||
    b === "prefer_cheap" ||
    b === "cheap"
  );
}

/**
 * Step down one rung on the Claude ladder (approx).
 * Hard-bug / Codex / Fable / Opus / Grok → Sonnet first (explore / quality-cheap).
 * Sonnet → Composer. Composer → Composer (already cheapest).
 */
export function pickCheaperFallback(
  primary: ModelId,
  opts?: { hardBug?: boolean },
): CheaperFallback {
  let name: ModelId;
  if (primary === "Composer 2.5") {
    name = "Composer 2.5";
  } else if (
    primary === "GPT-5 Codex" ||
    primary === "Fable 5" ||
    primary === "Claude Opus" ||
    primary === "Grok 5.x" ||
    opts?.hardBug
  ) {
    // Hard bugs: explore Sonnet first, then Composer (agents may chain)
    name = "Claude Sonnet";
  } else if (primary === "Claude Sonnet") {
    name = "Composer 2.5";
  } else {
    name = "Claude Sonnet";
  }
  return {
    name,
    slug: CURSOR_TASK_SLUG[name],
    tier: MODEL_TIER[name],
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
      en: `${base.en} · prefer_cheaper — explore with Sonnet first, then Composer; Codex if still stuck`,
      ko: `${base.ko} · prefer_cheaper — 탐색은 Sonnet 먼저, 그다음 Composer; 막히면 Codex`,
    };
  }
  if (preferCheaper) {
    return {
      en: `${base.en} · prefer_cheaper — Composer (bulk) or Sonnet (quality-cheap); ladder ${CLAUDE_LADDER_DOC}`,
      ko: `${base.ko} · prefer_cheaper — 대량은 Composer, 품질 유지 저가는 Sonnet; 사다리 ${CLAUDE_LADDER_DOC}`,
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
  tags: Tag[],
  text: string,
  tokenRisk: TokenRisk,
  preferCheaper: boolean,
  hardBug: boolean,
  fallback: CheaperFallback,
): string {
  const tagHint = tags.length ? `태그(${tags.join(", ")})` : "문맥 키워드";
  const hints: Record<ModelId, string> = {
    "Composer 2.5": "일상 루프·작은 수정·대량 기계·가성비",
    "Claude Sonnet": "저가 Claude mid — Fable/Codex 대체 품질",
    "Claude Opus": "Sonnet보다 강한 Claude mid-high",
    "Fable 5": "UI/넓은 범위·멀티파일 이해(고가 Claude UI)",
    "Grok 5.x": "구조·설계 추론(구현은 Composer/Sonnet/Fable로)",
    "GPT-5 Codex": "CI·난해한 버그·테스트 설계",
  };
  const short =
    text.trim().length > 80 ? `${text.trim().slice(0, 80)}…` : text.trim();
  let extra = "";
  if (preferCheaper && hardBug) {
    extra = ` prefer_cheaper(난해 버그): Codex primary 유지, cheaper_fallback=${fallback.name}(탐색 먼저) → Composer. 사다리: ${CLAUDE_LADDER_DOC}.`;
  } else if (preferCheaper && primary === "Composer 2.5") {
    extra = ` prefer_cheaper(대량·기계적): Composer primary — 토큰 절약. cheaper_fallback=${fallback.name}. 사다리: ${CLAUDE_LADDER_DOC}.`;
  } else if (preferCheaper && primary === "Claude Sonnet") {
    extra = ` prefer_cheaper(품질 유지 저가): Sonnet primary(Fable/Codex 대신). cheaper_fallback=${fallback.name}. 사다리: ${CLAUDE_LADDER_DOC}.`;
  } else if (preferCheaper) {
    extra = ` prefer_cheaper: cheaper_fallback=${fallback.name}(${fallback.slug}). 사다리: ${CLAUDE_LADDER_DOC}.`;
  } else if (tokenRisk === "low") {
    extra = " token_risk=low: 품질 우선 스코어링 유지.";
  } else {
    extra = ` cheaper_fallback=${fallback.name} (사다리: ${CLAUDE_LADDER_DOC}).`;
  }
  return `${tagHint} 기준 → 추천 ${primary}(${hints[primary]}, tier=${MODEL_TIER[primary]}). 대안 ${alternative}(${hints[alternative]}, tier=${MODEL_TIER[alternative]}).${extra} 과제: 「${short || "(설명 없음)"}」. 채팅 UI 모델은 자동 전환되지 않으니 host의 primary_id(또는 Cursor면 primary_slug / cheaper_fallback_slug)로 맞출 것.`;
}

function applyProjectConfig(
  scores: Record<ModelId, number>,
  cfg?: ProjectConfig,
): void {
  if (!cfg) return;
  const bias = cfg.cost_bias;
  if (isCheapBias(cfg)) {
    scores["Composer 2.5"] += 12;
    scores["Claude Sonnet"] += 10;
    scores["GPT-5 Codex"] -= 6;
    scores["Grok 5.x"] -= 4;
    scores["Fable 5"] -= 4;
  } else if (bias === "quality" || bias === "prefer_quality") {
    scores["GPT-5 Codex"] += 8;
    scores["Grok 5.x"] += 6;
    scores["Fable 5"] += 4;
    scores["Claude Opus"] += 4;
  }
  if (cfg.default_tier === "low") {
    scores["Composer 2.5"] += 8;
    scores["Claude Sonnet"] += 4;
  } else if (cfg.default_tier === "mid") {
    scores["Fable 5"] += 6;
    scores["Claude Sonnet"] += 4;
    scores["Claude Opus"] += 3;
    scores["Grok 5.x"] += 4;
  } else if (cfg.default_tier === "high") {
    scores["GPT-5 Codex"] += 8;
  }
  if (cfg.blocked_models?.length) {
    for (const raw of cfg.blocked_models) {
      const id = resolveModelId(raw);
      if (id) scores[id] -= 200;
    }
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

function ensureNotBlocked(
  primary: ModelId,
  alternative: ModelId,
  scores: Record<ModelId, number>,
  cfg?: ProjectConfig,
): [ModelId, ModelId] {
  const blocked = new Set(
    (cfg?.blocked_models ?? [])
      .map((m) => resolveModelId(m))
      .filter((m): m is ModelId => !!m),
  );
  let p = primary;
  let a = alternative;
  if (blocked.has(p)) {
    const ranked = [...MODELS].sort((x, y) => scores[y] - scores[x]);
    p = ranked.find((m) => !blocked.has(m)) ?? p;
  }
  if (blocked.has(a) || a === p) {
    const ranked = [...MODELS].sort((x, y) => scores[y] - scores[x]);
    a = ranked.find((m) => m !== p && !blocked.has(m)) ?? a;
  }
  return [p, a];
}

export function recommendModel(input: RecommendInput): RecommendResult {
  const text = input.task_description ?? "";
  const tags = input.tags ?? [];
  const cfg = input.project_config;
  const hostRaw = input.host ?? cfg?.preferred_host;
  const host = resolveHostId(hostRaw);
  const token_risk = estimateTokenRisk(text, tags);
  const hardBug = isHardBugTask(text, tags);
  const uiTask = isUiTask(text, tags);
  const scores: Record<ModelId, number> = { ...BASE };

  for (const tag of tags) {
    const boost = TAG_BOOST[tag];
    if (boost) addScores(scores, boost);
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) addScores(scores, rule.boost);
  }

  // 아키텍처 태그는 구현 전체 Grok 고정 방지: 대안이 Composer/Sonnet/Fable이 되게
  if (tags.includes("architecture") && !tags.includes("ui")) {
    scores["Composer 2.5"] += 5;
    scores["Claude Sonnet"] += 3;
  }

  const prefer_cheaper =
    token_risk === "high" ||
    isCheapBias(cfg) ||
    !!input.usage_prefer_cheaper;

  // high + bulk/mechanical (not hard bug, not UI): boost cheaper before ranking
  if (prefer_cheaper && !hardBug && !uiTask && isBulkMechanical(text)) {
    scores["Composer 2.5"] += 55;
    scores["GPT-5 Codex"] -= 20;
    scores["Fable 5"] -= 10;
  }

  // prefer_cheaper + UI (not hard bug): boost Sonnet as quality-cheap vs Fable
  if (prefer_cheaper && uiTask && !hardBug) {
    scores["Claude Sonnet"] += 40;
    scores["Fable 5"] -= 25;
    scores["Composer 2.5"] += 8;
  }

  applyProjectConfig(scores, cfg);

  if (input.feedback_adjust) {
    for (const [k, v] of Object.entries(input.feedback_adjust) as [
      ModelId,
      number,
    ][]) {
      if (typeof v === "number" && Number.isFinite(v)) scores[k] += v;
    }
  }

  let [primary, alternative] = topTwo(scores);

  if (prefer_cheaper) {
    // UI quality-cheap first (Sonnet over Fable); bulk mechanical → Composer
    if (uiTask && !hardBug) {
      const qualityCheap: ModelId =
        scores["Composer 2.5"] >= scores["Claude Sonnet"] + 20
          ? "Composer 2.5"
          : "Claude Sonnet";
      if (primary !== qualityCheap) {
        alternative = primary;
        primary = qualityCheap;
      }
    } else if (!hardBug && isBulkMechanical(text)) {
      const cheap: ModelId = "Composer 2.5";
      if (primary !== cheap) {
        alternative = primary;
        primary = cheap;
      } else if (alternative === cheap) {
        const ranked = [...MODELS].sort((a, b) => scores[b] - scores[a]);
        alternative = ranked.find((m) => m !== cheap) ?? alternative;
      }
    }
  }

  [primary, alternative] = ensureNotBlocked(primary, alternative, scores, cfg);

  const cheaper_fallback = pickCheaperFallback(primary, { hardBug });
  const cheaper_fallback_slug = cheaper_fallback.slug;

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
    tags,
    text,
    token_risk,
    prefer_cheaper,
    hardBug,
    cheaper_fallback,
  );
  if (stick_action === "keep") {
    reason = `sticky 유지: 현재 ${currentResolved} = 추천 primary. ${reason}`;
  } else if (stick_action === "switch") {
    reason = `전환 제안: 현재 ${currentResolved} → 추천 ${primary}. ${reason}`;
  }
  if (cfg?.cost_bias && cfg.cost_bias !== "balanced") {
    reason += ` project cost_bias=${cfg.cost_bias}.`;
  }
  if (input.usage_prefer_cheaper) {
    reason += " usage alerts → prefer_cheaper.";
  }

  const recommendation_id = makeRecommendationId(text, primary, alternative);

  return {
    primary,
    alternative,
    reason,
    scores,
    primary_slug: CURSOR_TASK_SLUG[primary],
    alternative_slug: CURSOR_TASK_SLUG[alternative],
    host,
    primary_id: hostModelId(host, primary),
    alternative_id: hostModelId(host, alternative),
    primary_cost_tier: COST_TIER[primary],
    alternative_cost_tier: COST_TIER[alternative],
    primary_tier: MODEL_TIER[primary],
    alternative_tier: MODEL_TIER[alternative],
    token_risk,
    prefer_cheaper,
    cheaper_fallback,
    cheaper_fallback_slug,
    usage_estimate: buildUsageEstimate(
      primary,
      token_risk,
      prefer_cheaper,
      hardBug,
    ),
    recommendation_id,
    ...(stick_action
      ? {
          stick_action,
          current_resolved: currentResolved,
          ...(stick_action === "keep" ? { sticky_suggest: "keep_silent" as const } : {}),
        }
      : {}),
  };
}
