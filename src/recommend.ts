/**
 * ChronoCode model-selection.mdc 와 동일한 스코어링.
 * 출력 모델명: Composer 2.5 / Fable 5 / Grok 5.x / GPT-5 Codex
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
  | "Fable 5"
  | "Grok 5.x"
  | "GPT-5 Codex";

/** Relative cost/weight — not dollar amounts */
export type CostTier = "low" | "medium" | "medium-high" | "high";

/**
 * Coarse model tier (docs / vibe-coding pick):
 * low = Composer · mid = Fable/Grok · high = Codex
 */
export type ModelTier = "low" | "mid" | "high";

/** Estimated context/token burn for this task (not $) */
export type TokenRisk = "low" | "medium" | "high";

export type Tag = "ui" | "bug" | "architecture" | "test";

export interface UsageEstimate {
  en: string;
  ko: string;
}

/** Relative cost map (Composer cheapest → Codex heaviest) */
export const COST_TIER: Record<ModelId, CostTier> = {
  "Composer 2.5": "low",
  "Fable 5": "medium",
  "Grok 5.x": "medium-high",
  "GPT-5 Codex": "high",
};

/** Coarse tier aligned with COST_TIER (Fable+Grok both mid) */
export const MODEL_TIER: Record<ModelId, ModelTier> = {
  "Composer 2.5": "low",
  "Fable 5": "mid",
  "Grok 5.x": "mid",
  "GPT-5 Codex": "high",
};

const USAGE_ESTIMATE: Record<ModelId, UsageEstimate> = {
  "Composer 2.5": {
    en: "light daily loop — prefer for small patches",
    ko: "가벼운 일상 루프 — 작은 수정에 적합",
  },
  "Fable 5": {
    en: "mid-weight multi-file / UI job",
    ko: "중간 무게 멀티파일·UI 작업",
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
}

/** Cursor Task tool `model` 파라미터용 slug (UI 표시명과 별도) */
export const CURSOR_TASK_SLUG: Record<ModelId, string> = {
  "Composer 2.5": "composer-2.5-fast",
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
  if (lower.includes("fable")) return "Fable 5";
  if (lower.includes("grok")) return "Grok 5.x";
  if (lower.includes("codex") || lower.includes("gpt-5")) return "GPT-5 Codex";
  if (lower.startsWith("role:")) {
    if (lower.includes("light")) return "Composer 2.5";
    if (lower.includes("mid")) return "Fable 5";
    if (lower.includes("design")) return "Grok 5.x";
    if (lower.includes("heavy")) return "GPT-5 Codex";
  }
  return null;
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
  /** Coarse tier: low=Composer mid=Fable/Grok high=Codex */
  primary_tier: ModelTier;
  alternative_tier: ModelTier;
  /** Estimated token/context burn for this task */
  token_risk: TokenRisk;
  /**
   * true when token_risk=high: bulk → cheaper primary already;
   * hard bug → keep Codex but try Composer first for exploration
   */
  prefer_cheaper: boolean;
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
  "Fable 5",
  "Grok 5.x",
  "GPT-5 Codex",
];

/** 기본 비중 반영 베이스 점수 */
const BASE: Record<ModelId, number> = {
  "Composer 2.5": 40,
  "Fable 5": 15,
  "Grok 5.x": 8,
  "GPT-5 Codex": 5,
};

const TAG_BOOST: Record<Tag, Partial<Record<ModelId, number>>> = {
  ui: { "Fable 5": 35, "Composer 2.5": 5 },
  // Codex must beat Composer BASE(40) even without keyword matches
  bug: { "GPT-5 Codex": 50, "Composer 2.5": 5 },
  architecture: { "Grok 5.x": 45, "Fable 5": 10 },
  test: { "GPT-5 Codex": 50, "Composer 2.5": 5 },
};

const KEYWORD_RULES: Array<{
  re: RegExp;
  boost: Partial<Record<ModelId, number>>;
}> = [
  {
    re: /ui|ux|디자인|화면|레이아웃|프론트|css|스타일|컴포넌트|랜딩|히어로/i,
    boost: { "Fable 5": 25, "Composer 2.5": 5 },
  },
  {
    re: /리팩터|리팩토링|멀티\s*파일|넓은|대규모|코드베이스|아키텍처\s*이해/i,
    boost: { "Fable 5": 30, "Composer 2.5": 5 },
  },
  {
    re: /설계|구조|아키텍처|기술\s*선택|어떻게\s*짤|기획|트레이드.?오프|의사결정/i,
    boost: { "Grok 5.x": 40, "Fable 5": 8 },
  },
  {
    re: /ci\s*실패|테스트\s*설계|재현|난해|플레?이키|디버그|버그|회귀|타입\s*에러/i,
    boost: { "GPT-5 Codex": 35, "Composer 2.5": 10 },
  },
  {
    re: /i18n|문구|카피|한\s*줄|타이포|주석|lint|작은|퀵|핫픽스|문구\s*수정/i,
    boost: { "Composer 2.5": 30 },
  },
  {
    re: /기능\s*추가|버그픽스|패치|루프|일상|가성비/i,
    boost: { "Composer 2.5": 20 },
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

/** Estimate token/context burn from description (+ tags as weak hints) */
export function estimateTokenRisk(
  text: string,
  tags: Tag[] = [],
): TokenRisk {
  const t = text ?? "";
  if (HIGH_TOKEN_RE.test(t)) return "high";
  if (LOW_TOKEN_RE.test(t)) return "low";
  // architecture alone is not high — medium default
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

function buildUsageEstimate(
  primary: ModelId,
  tokenRisk: TokenRisk,
  preferCheaper: boolean,
  hardBug: boolean,
): UsageEstimate {
  const base = USAGE_ESTIMATE[primary];
  if (tokenRisk !== "high") return { ...base };
  if (hardBug && preferCheaper) {
    return {
      en: `${base.en} · high token risk — try Composer first for exploration, then Codex`,
      ko: `${base.ko} · 토큰 위험 높음 — 탐색은 Composer 먼저, 막히면 Codex`,
    };
  }
  if (preferCheaper) {
    return {
      en: `${base.en} · high token risk — cheaper primary for bulk/mechanical work`,
      ko: `${base.ko} · 토큰 위험 높음 — 대량·기계적 작업은 저가 모델 우선`,
    };
  }
  return {
    en: `${base.en} · high token risk`,
    ko: `${base.ko} · 토큰 위험 높음`,
  };
}

function buildReason(
  primary: ModelId,
  alternative: ModelId,
  tags: Tag[],
  text: string,
  tokenRisk: TokenRisk,
  preferCheaper: boolean,
  hardBug: boolean,
): string {
  const tagHint = tags.length ? `태그(${tags.join(", ")})` : "문맥 키워드";
  const hints: Record<ModelId, string> = {
    "Composer 2.5": "일상 루프·작은 수정·가성비에 맞음",
    "Fable 5": "UI/넓은 범위·멀티파일 이해에 맞음",
    "Grok 5.x": "구조·설계 추론에 맞음(구현은 Composer/Fable로)",
    "GPT-5 Codex": "CI·난해한 버그·테스트 설계에 맞음",
  };
  const short =
    text.trim().length > 80 ? `${text.trim().slice(0, 80)}…` : text.trim();
  let extra = "";
  if (tokenRisk === "high" && hardBug && preferCheaper) {
    extra =
      " token_risk=high(난해 버그): Codex primary 유지, 탐색·로그 훑기는 Composer 먼저(prefer_cheaper).";
  } else if (tokenRisk === "high" && preferCheaper) {
    extra =
      " token_risk=high(대량·기계적): 저가 tier(Composer) primary — 토큰 절약.";
  } else if (tokenRisk === "low") {
    extra = " token_risk=low: 품질 우선 스코어링 유지.";
  }
  return `${tagHint} 기준 → 추천 ${primary}(${hints[primary]}, tier=${MODEL_TIER[primary]}). 대안 ${alternative}(${hints[alternative]}, tier=${MODEL_TIER[alternative]}).${extra} 과제: 「${short || "(설명 없음)"}」. 채팅 UI 모델은 자동 전환되지 않으니 host의 primary_id(또는 Cursor면 primary_slug)로 맞출 것.`;
}

function applyProjectConfig(
  scores: Record<ModelId, number>,
  cfg?: ProjectConfig,
): void {
  if (!cfg) return;
  const bias = cfg.cost_bias;
  if (bias === "prefer_cheaper" || bias === "prefer_cheap") {
    scores["Composer 2.5"] += 12;
    scores["GPT-5 Codex"] -= 6;
    scores["Grok 5.x"] -= 4;
  } else if (bias === "quality" || bias === "prefer_quality") {
    scores["GPT-5 Codex"] += 8;
    scores["Grok 5.x"] += 6;
    scores["Fable 5"] += 4;
  }
  if (cfg.default_tier === "low") {
    scores["Composer 2.5"] += 8;
  } else if (cfg.default_tier === "mid") {
    scores["Fable 5"] += 6;
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
  const scores: Record<ModelId, number> = { ...BASE };

  for (const tag of tags) {
    const boost = TAG_BOOST[tag];
    if (boost) addScores(scores, boost);
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) addScores(scores, rule.boost);
  }

  // 아키텍처 태그는 구현 전체 Grok 고정 방지: 대안이 Composer/Fable이 되게
  if (tags.includes("architecture") && !tags.includes("ui")) {
    scores["Composer 2.5"] += 5;
  }

  // high + bulk/mechanical (not hard bug): boost cheaper before ranking
  if (token_risk === "high" && !hardBug && isBulkMechanical(text)) {
    scores["Composer 2.5"] += 55;
    scores["GPT-5 Codex"] -= 20;
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
  let prefer_cheaper = false;

  if (token_risk === "high") {
    prefer_cheaper = true;
    if (!hardBug && isBulkMechanical(text)) {
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
  );
  if (stick_action === "keep") {
    reason = `sticky 유지: 현재 ${currentResolved} = 추천 primary. ${reason}`;
  } else if (stick_action === "switch") {
    reason = `전환 제안: 현재 ${currentResolved} → 추천 ${primary}. ${reason}`;
  }
  if (cfg?.cost_bias && cfg.cost_bias !== "balanced") {
    reason += ` project cost_bias=${cfg.cost_bias}.`;
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
