import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXAMPLE_PROMPTS } from "../src/examples.ts";
import {
  getFeedbackAdjustments,
  logFeedback,
} from "../src/feedback.ts";
import { loadProjectConfig } from "../src/projectConfig.ts";
import {
  COST_TIER,
  CURSOR_AGENT_CATALOG,
  MODEL_TIER,
  analyzeCommand,
  buildCostPreview,
  compactRecommendResult,
  costTierToWeight,
  recommendModel,
  type CostTier,
  type TokenRisk,
} from "../src/recommend.ts";
import { clearSticky, getSticky, setSticky } from "../src/sticky.ts";
import {
  buildHowToRefreshMcp,
  EXPECTED_TOOL_NAMES,
  mcpRefreshSessionHint,
} from "../src/refreshHelp.ts";
import { verifyBuiltInScenarios, verifyRecommendPayload } from "../src/compliance.ts";
import { getUsageSummary, logModelUsage } from "../src/usage.ts";
import { getVersionInfo, buildUpdateHint } from "../src/version.ts";

type Case = {
  name: string;
  input: {
    task_description: string;
    tags?: Array<"ui" | "bug" | "architecture" | "test">;
    current_model?: string;
    project_config?: {
      blocked_models?: string[];
      unavailable_models?: string[];
      cost_bias?: "prefer_cheap" | "prefer_cheaper" | "balanced" | "prefer_quality" | "quality" | "cheap";
      preferred_host?: "cursor" | "claude" | "openai" | "generic";
    };
  };
  expectPrimary: string;
  expectStick?: "keep" | "switch";
  expectCost?: CostTier;
  expectTokenRisk?: TokenRisk;
  expectPreferCheaper?: boolean;
  expectFallback?: string;
  expectSlug?: string;
};

const cases: Case[] = [
  {
    name: "일상 패치",
    input: { task_description: "로그인 문구 i18n 한 줄 수정" },
    expectPrimary: "Composer 2.5",
    expectCost: "low",
    expectPreferCheaper: true,
  },
  {
    name: "UI 태그 → Sonnet(절약 기본)",
    input: { task_description: "대시보드 레이아웃 리팩터", tags: ["ui"] },
    expectPrimary: "Claude Sonnet",
    expectCost: "medium",
    expectPreferCheaper: true,
    expectFallback: "Composer 2.5",
  },
  {
    name: "넓은 UI 리디자인 → Fable",
    input: {
      task_description: "랜딩 히어로 전면 리디자인 — 전체 UI 레이아웃 개편",
      tags: ["ui"],
    },
    expectPrimary: "Fable 5",
    expectPreferCheaper: true,
  },
  {
    name: "아키텍처",
    input: {
      task_description: "결제 모듈 구조 설계와 기술 선택",
      tags: ["architecture"],
    },
    expectPrimary: "Fable 5",
    expectCost: "medium-high",
  },
  {
    name: "설계→구현 switch",
    input: {
      task_description: "방금 설계한 결제 모듈 구현해보자",
      current_model: "Grok 5.x",
    },
    expectPrimary: "Composer 2.5",
    expectStick: "switch",
  },
  {
    name: "설계+구현 혼합",
    input: {
      task_description: "결제 모듈 설계 구현 해보자",
      current_model: "claude-fable-5-thinking-high",
    },
    expectPrimary: "Composer 2.5",
    expectStick: "switch",
  },
  {
    name: "버그/CI → Terra",
    input: {
      task_description: "CI 실패 재현과 난해한 타입 에러",
      tags: ["bug"],
    },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
    expectSlug: "gpt-5.6-terra-medium",
    expectFallback: "GPT-5 Sol",
  },
  {
    name: "bug 태그 단독",
    input: { task_description: "neutral task xyz", tags: ["bug"] },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
  },
  {
    name: "test 태그 단독",
    input: { task_description: "unit tests", tags: ["test"] },
    expectPrimary: "GPT-5 Codex",
  },
  {
    name: "sticky keep",
    input: {
      task_description: "로그인 문구 i18n 한 줄 수정",
      current_model: "composer-2.5-fast",
    },
    expectPrimary: "Composer 2.5",
    expectStick: "keep",
  },
  {
    name: "sticky switch",
    input: {
      task_description: "대시보드 레이아웃 리팩터",
      tags: ["ui"],
      current_model: "Composer 2.5",
    },
    expectPrimary: "Claude Sonnet",
    expectStick: "switch",
  },
  {
    name: "token high bulk → Composer",
    input: {
      task_description:
        "전체 코드베이스 대량 리팩터 전부 — 모든 파일 일괄 rename·마이그레이션",
    },
    expectPrimary: "Composer 2.5",
    expectCost: "low",
    expectTokenRisk: "high",
    expectPreferCheaper: true,
    expectFallback: "Composer 2.5",
  },
  {
    name: "token high hard-bug → Terra + Sol fallback",
    input: {
      task_description:
        "CI 실패 재현과 난해한 타입 에러 — 긴 로그·대량 스택트레이스 전체 분석",
      tags: ["bug"],
    },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
    expectTokenRisk: "high",
    expectPreferCheaper: true,
    expectFallback: "GPT-5 Sol",
  },
  {
    name: "token low i18n",
    input: { task_description: "로그인 문구 i18n 한 줄 수정" },
    expectPrimary: "Composer 2.5",
    expectTokenRisk: "low",
    expectPreferCheaper: true,
    expectFallback: "Composer 2.5",
  },
  {
    name: "cost_bias cheap UI → Sonnet",
    input: {
      task_description: "대시보드 레이아웃 리팩터",
      tags: ["ui"],
      project_config: { cost_bias: "prefer_cheaper" },
    },
    expectPrimary: "Claude Sonnet",
    expectPreferCheaper: true,
    expectFallback: "Composer 2.5",
  },
  {
    name: "premium UI → Fable",
    input: {
      task_description: "대시보드 레이아웃 — 최고 품질로, 비싸도 됨",
      tags: ["ui"],
      project_config: { cost_bias: "quality" },
    },
    expectPrimary: "Fable 5",
    expectPreferCheaper: false,
  },
  {
    name: "blocked Codex → Sol",
    input: {
      task_description: "CI 실패 재현과 난해한 타입 에러",
      tags: ["bug"],
      project_config: { blocked_models: ["GPT-5 Codex"] },
    },
    expectPrimary: "GPT-5 Sol",
  },
  {
    name: "Sonnet blocked UI → Composer",
    input: {
      task_description: "대시보드 레이아웃 UX",
      tags: ["ui"],
      project_config: { unavailable_models: ["Claude Sonnet"] },
    },
    expectPrimary: "Composer 2.5",
  },
];

let failed = 0;
let extraChecks = 0;

for (const c of cases) {
  const r = recommendModel(c.input);
  const stickOk =
    c.expectStick == null ? true : r.stick_action === c.expectStick;
  const costOk =
    c.expectCost == null ? true : r.primary_cost_tier === c.expectCost;
  const riskOk =
    c.expectTokenRisk == null ? true : r.token_risk === c.expectTokenRisk;
  const preferOk =
    c.expectPreferCheaper == null
      ? true
      : r.prefer_cheaper === c.expectPreferCheaper;
  const fallbackOk =
    !!r.cheaper_fallback?.name &&
    !!r.cheaper_fallback_slug &&
    r.cheaper_fallback.slug === r.cheaper_fallback_slug &&
    Array.isArray(r.candidates) &&
    r.candidates.length >= 2 &&
    r.candidates[0]?.name === r.primary &&
    r.candidates[0]?.id === r.primary_id &&
    Array.isArray(r.fallback_chain) &&
    r.fallback_chain.length >= 2 &&
    (c.expectFallback == null ||
      r.cheaper_fallback.name === c.expectFallback);
  const slugOk =
    c.expectSlug == null ? true : r.primary_slug === c.expectSlug;
  const catalogOk =
    CURSOR_AGENT_CATALOG.includes(
      r.primary_slug as (typeof CURSOR_AGENT_CATALOG)[number],
    ) &&
    r.fallback_chain.every((s) =>
      CURSOR_AGENT_CATALOG.includes(s as (typeof CURSOR_AGENT_CATALOG)[number]),
    );
  const estimateOk =
    !!r.usage_estimate?.en &&
    !!r.recommendation_id &&
    r.primary_cost_tier === COST_TIER[r.primary] &&
    r.primary_tier === MODEL_TIER[r.primary] &&
    typeof r.prefer_cheaper === "boolean" &&
    !!r.token_risk &&
    r.reason.length < 220;
  const keepSilentOk =
    c.expectStick !== "keep" || r.sticky_suggest === "keep_silent";
  const ok =
    r.primary === c.expectPrimary &&
    !!r.primary_slug &&
    !!r.alternative &&
    stickOk &&
    costOk &&
    riskOk &&
    preferOk &&
    fallbackOk &&
    slugOk &&
    catalogOk &&
    estimateOk &&
    keepSilentOk;
  const mark = ok ? "OK" : "FAIL";
  console.log(
    `[${mark}] ${c.name}: primary=${r.primary} slug=${r.primary_slug}` +
      ` fb=${r.cheaper_fallback?.name} chain=${r.fallback_chain.join(">")}` +
      ` prefer=${r.prefer_cheaper} reason=${r.reason.slice(0, 60)}`,
  );
  if (!ok) {
    failed += 1;
    console.error(
      `  expected primary=${c.expectPrimary}` +
        (c.expectFallback ? ` fallback=${c.expectFallback}` : "") +
        `, got primary=${r.primary} fallback=${r.cheaper_fallback?.name}` +
        ` stick=${r.stick_action ?? "(none)"} prefer=${r.prefer_cheaper}`,
    );
  }
}

for (const ex of EXAMPLE_PROMPTS) {
  const r = recommendModel({
    task_description: ex.ko,
    tags: ex.tags,
  });
  const allowed = ex.expected_primaries ?? [ex.expected_primary];
  const ok = allowed.includes(r.primary);
  console.log(
    `[${ok ? "OK" : "FAIL"}] example:${ex.category}: primary=${r.primary} (expect one of ${allowed.join("|")})`,
  );
  if (!ok) failed += 1;
}

// design primary is not always Fable
{
  const designPrompts = [
    "결제 모듈 구조 설계와 기술 선택 트레이드오프",
    "간단 계획만 — 다음 스프린트 뭐 할지 짧게 정리",
    "UI 설계 와이어프레임 — 대시보드 화면 구조만",
    "최고 품질로 시스템 아키텍처 트레이드오프 정리",
  ];
  const primaries = designPrompts.map(
    (task_description) =>
      recommendModel({ task_description, tags: ["architecture"] }).primary,
  );
  const allFable = primaries.every((p) => p === "Fable 5");
  const hasSonnet = primaries.some((p) => p === "Claude Sonnet");
  const ok = !allFable && primaries.length >= 2;
  console.log(
    `[${ok ? "OK" : "FAIL"}] architecture primary varies: ${primaries.join(",")} (allFable=${allFable} sonnet=${hasSonnet})`,
  );
  extraChecks += 1;
  if (!ok) failed += 1;
}

// analyzeCommand budget
{
  const save = analyzeCommand("토큰 아껴서 싸게 패치해줘");
  const prem = analyzeCommand("최고 성능으로, 비싸도 됨");
  const ok =
    save.budget === "save" &&
    prem.budget === "premium" &&
    save.why.length > 0;
  console.log(`[${ok ? "OK" : "FAIL"}] analyzeCommand budget`);
  extraChecks += 1;
  if (!ok) failed += 1;
}

// compact payload
{
  const r = recommendModel({ task_description: "i18n 한 줄" });
  const c = compactRecommendResult(r, { mcp_version: "0.7.1" });
  const clarity = c.clarity as { ko?: string; en?: string } | undefined;
  const honest = c.honest_limit as { ko?: string; en?: string } | undefined;
  const costPreview = c.cost_preview as
    | {
        weight?: string;
        relative?: { ko?: string; en?: string };
        advice?: { ko?: string; en?: string };
      }
    | undefined;
  const forTask = c.for_task as
    | { primary?: string; primary_id?: string; cost_tier?: string }
    | undefined;
  const ok =
    !!c.primary &&
    !!c.cheaper_fallback_slug &&
    Array.isArray(c.candidates) &&
    (c.candidates as unknown[]).length >= 2 &&
    Array.isArray(c.fallback_chain) &&
    (c.fallback_chain as unknown[]).length >= 2 &&
    forTask?.primary === r.primary &&
    forTask?.primary_id === r.primary_id &&
    forTask?.cost_tier === r.primary_cost_tier &&
    !!clarity?.ko &&
    clarity.ko.includes("작업용 추천") &&
    clarity.ko.includes("맞음") &&
    !!clarity?.en &&
    !!honest?.ko &&
    honest.ko.includes("자동 전환") &&
    !!honest?.en &&
    costPreview?.weight === "light" &&
    !!costPreview?.relative?.ko &&
    costPreview.relative.ko.includes("1×") &&
    !!costPreview?.advice?.ko &&
    costPreview.advice.ko.includes("Composer") &&
    !!(c.run_hint as { ko?: string; task_model?: string })?.ko?.includes(
      r.primary_id,
    ) &&
    !!(c.agent_note as { ko?: string })?.ko?.includes("primary_id") &&
    c.mcp_version === "0.7.1" &&
    !!(c.must_do as { ko?: string[]; task_model?: string })?.ko?.length &&
    (c.must_do as { task_model?: string }).task_model === r.primary_id &&
    !("scores" in c) &&
    !("usage_estimate" in c);
  console.log(`[${ok ? "OK" : "FAIL"}] compactRecommendResult clarity + cost_preview`);
  extraChecks += 1;
  if (!ok) failed += 1;
}

// cost_preview weight mapping + Codex heavy advice
{
  const tiny = recommendModel({ task_description: "i18n 한 줄" });
  const bug = recommendModel({
    task_description: "CI 실패 재현과 난해한 타입 에러",
    tags: ["bug"],
  });
  const ok =
    tiny.cost_preview.weight === "light" &&
    costTierToWeight(tiny.primary_cost_tier) === "light" &&
    bug.cost_preview.weight === "heavy" &&
    bug.primary === "GPT-5 Codex" &&
    !!bug.cost_preview.advice.ko &&
    bug.cost_preview.relative.ko.includes("4–5×") &&
    buildCostPreview("Composer 2.5", "low", analyzeCommand("한 줄"), true)
      .advice.ko.includes("맞음");
  console.log(`[${ok ? "OK" : "FAIL"}] cost_preview weight + advice`);
  extraChecks += 1;
  if (!ok) failed += 1;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-mcp-smoke-"));
const tmpUsage = path.join(tmpDir, "usage.jsonl");
const tmpSticky = path.join(tmpDir, "sticky.json");
const tmpFeedback = path.join(tmpDir, "feedback.jsonl");
const tmpProjectDir = path.join(tmpDir, "proj");
fs.mkdirSync(tmpProjectDir);

try {
  logModelUsage(
    { model: "composer-2.5-fast", task_tag: "ui", note: "smoke" },
    { path: tmpUsage },
  );
  for (let i = 0; i < 5; i++) {
    logModelUsage({ model: "GPT-5 Codex", task_tag: "bug" }, { path: tmpUsage });
  }
  const summary = getUsageSummary({
    path: tmpUsage,
    period: "day",
    alert_thresholds: { high_tier_today: 3 },
  });
  const alertOk =
    summary.alerts.some((x) => x.code === "high_tier_today") &&
    !!summary.report?.ko;
  console.log(`[${alertOk ? "OK" : "FAIL"}] usage alerts`);
  extraChecks += 1;
  if (!alertOk) failed += 1;

  setSticky(
    { adopted_model: "Composer 2.5", host: "cursor" },
    { path: tmpSticky },
  );
  const stickyForSession = getSticky({ path: tmpSticky });
  const sessionRec = recommendModel({
    task_description: "로그인 문구 i18n 한 줄 수정",
    current_model: stickyForSession.sticky?.adopted_model,
  });
  const sessionOk =
    stickyForSession.sticky?.adopted_model === "Composer 2.5" &&
    sessionRec.stick_action === "keep";
  console.log(`[${sessionOk ? "OK" : "FAIL"}] sticky keep session`);
  extraChecks += 1;
  if (!sessionOk) failed += 1;

  const red = logModelUsage(
    { model: "Fable 5", note: "token=abc123 secret: xyz" },
    { path: tmpUsage },
  );
  const redOk =
    !!red.entry.note &&
    !red.entry.note.includes("abc123") &&
    red.entry.note.includes("[redacted]");
  console.log(`[${redOk ? "OK" : "FAIL"}] usage secret redaction`);
  extraChecks += 1;
  if (!redOk) failed += 1;

  const set = setSticky(
    { adopted_model: "Composer 2.5", host: "cursor", context_hint: "i18n" },
    { path: tmpSticky },
  );
  const cleared = clearSticky({ path: tmpSticky });
  const stickFileOk =
    set.ok && cleared.cleared && getSticky({ path: tmpSticky }).sticky == null;
  console.log(`[${stickFileOk ? "OK" : "FAIL"}] sticky file`);
  extraChecks += 1;
  if (!stickFileOk) failed += 1;

  const cfgPath = path.join(tmpProjectDir, ".compass-mcp.json");
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({
      preferred_host: "claude",
      cost_bias: "prefer_cheap",
      unavailable_models: ["Grok 5.x"],
    }),
    "utf8",
  );
  const loaded = loadProjectConfig({ startDir: tmpProjectDir });
  const withHost = recommendModel({
    task_description: "로그인 문구 i18n 한 줄 수정",
    project_config: loaded.config,
  });
  const cfgOk =
    loaded.found &&
    loaded.config.cost_bias === "prefer_cheap" &&
    withHost.host === "claude";
  console.log(`[${cfgOk ? "OK" : "FAIL"}] project config`);
  extraChecks += 1;
  if (!cfgOk) failed += 1;

  logFeedback(
    { vote: "bad", primary: "GPT-5 Codex", models: ["GPT-5 Codex"] },
    { path: tmpFeedback },
  );
  logFeedback(
    { vote: "good", primary: "Composer 2.5" },
    { path: tmpFeedback },
  );
  const adj = getFeedbackAdjustments({ path: tmpFeedback });
  const fbOk =
    (adj["Composer 2.5"] ?? 0) > 0 && (adj["GPT-5 Codex"] ?? 0) < 0;
  console.log(`[${fbOk ? "OK" : "FAIL"}] feedback`);
  extraChecks += 1;
  if (!fbOk) failed += 1;
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

{
  const cursor = recommendModel({
    task_description: "로그인 문구 i18n 한 줄 수정",
    host: "cursor",
  });
  const claude = recommendModel({
    task_description: "CI 실패 재현과 난해한 타입 에러",
    tags: ["bug"],
    host: "claude",
  });
  const openai = recommendModel({
    task_description: "결제 모듈 구조 설계",
    tags: ["architecture"],
    host: "openai",
  });
  const generic = recommendModel({
    task_description: "대시보드 레이아웃",
    tags: ["ui"],
    host: "forge",
  });
  const vscode = recommendModel({
    task_description: "결제 모듈 구조 설계",
    tags: ["architecture"],
    host: "vscode",
  });
  const hostOk =
    cursor.host === "cursor" &&
    cursor.primary_id === cursor.primary_slug &&
    cursor.primary_slug === "composer-2.5-fast" &&
    cursor.candidates.length >= 2 &&
    claude.primary === "GPT-5 Codex" &&
    claude.cheaper_fallback.name === "GPT-5 Sol" &&
    claude.candidates.length >= 2 &&
    openai.primary === "Fable 5" &&
    generic.host === "generic" &&
    generic.primary_id === "role:sonnet" &&
    vscode.host === "generic" &&
    vscode.candidates.length >= 2;
  console.log(
    `[${hostOk ? "OK" : "FAIL"}] hosts terra=${claude.primary_id} gen=${generic.primary_id} vscode=${vscode.host}`,
  );
  extraChecks += 1;
  if (!hostOk) failed += 1;
}

{
  const hard = recommendModel({
    task_description: "CI 실패 재현과 난해한 타입 에러 — 긴 로그 전체 분석",
    tags: ["bug"],
  });
  const fbOk =
    hard.primary_slug === "gpt-5.6-terra-medium" &&
    hard.cheaper_fallback_slug === "gpt-5.6-sol-medium" &&
    hard.candidates.length >= 2 &&
    hard.candidates[0]?.name === "GPT-5 Codex" &&
    hard.fallback_chain[0] === hard.primary_slug &&
    hard.fallback_chain.includes("gpt-5.6-sol-medium") &&
    hard.fallback_chain.includes("claude-sonnet-5-thinking-high");
  console.log(
    `[${fbOk ? "OK" : "FAIL"}] fallback_chain=${hard.fallback_chain.join(",")}`,
  );
  extraChecks += 1;
  if (!fbOk) failed += 1;
}

{
  const cursorKo = buildHowToRefreshMcp({ host: "cursor", locale: "ko" });
  const hint = mcpRefreshSessionHint();
  const refreshOk =
    cursorKo.steps_ko.some((s) => s.includes("Tools & MCP")) &&
    EXPECTED_TOOL_NAMES.includes("recommend_model") &&
    hint.tool === "how_to_refresh_mcp";
  console.log(`[${refreshOk ? "OK" : "FAIL"}] how_to_refresh_mcp`);
  extraChecks += 1;
  if (!refreshOk) failed += 1;
}

{
  const v = getVersionInfo({ skip_fetch: true });
  const hint = buildUpdateHint(v, "ko");
  const ok =
    v.version === "0.7.1" &&
    v.name === "compass-mcp" &&
    !!hint.message &&
    EXPECTED_TOOL_NAMES.includes("check_update") &&
    EXPECTED_TOOL_NAMES.includes("verify_run_compliance");
  console.log(`[${ok ? "OK" : "FAIL"}] check_update version=${v.version}`);
  extraChecks += 1;
  if (!ok) failed += 1;
}

{
  const builtIn = verifyBuiltInScenarios("0.7.1");
  const ok = builtIn.ok && builtIn.checks.length >= 15;
  console.log(
    `[${ok ? "OK" : "FAIL"}] verify_run_compliance built_in checks=${builtIn.checks.filter((x) => !x.ok).length} fail`,
  );
  extraChecks += 1;
  if (!ok) failed += 1;
}

const total = cases.length + EXAMPLE_PROMPTS.length + extraChecks;
if (failed > 0) {
  console.error(`smoke failed: ${failed}/${total}`);
  process.exit(1);
}
console.log(
  `smoke ok: ${total}/${total} (cases=${cases.length} examples=${EXAMPLE_PROMPTS.length} extra=${extraChecks})`,
);
