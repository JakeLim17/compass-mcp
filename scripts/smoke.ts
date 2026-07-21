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
  MODEL_TIER,
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
import { getUsageSummary, logModelUsage } from "../src/usage.ts";

type Case = {
  name: string;
  input: {
    task_description: string;
    tags?: Array<"ui" | "bug" | "architecture" | "test">;
    current_model?: string;
    project_config?: {
      blocked_models?: string[];
      cost_bias?: "prefer_cheap" | "prefer_cheaper" | "balanced" | "prefer_quality";
      preferred_host?: "cursor" | "claude" | "openai" | "generic";
    };
  };
  expectPrimary: string;
  expectStick?: "keep" | "switch";
  expectCost?: CostTier;
  expectTokenRisk?: TokenRisk;
  expectPreferCheaper?: boolean;
  expectFallback?: string;
};

const cases: Case[] = [
  {
    name: "일상 패치",
    input: { task_description: "로그인 문구 i18n 한 줄 수정" },
    expectPrimary: "Composer 2.5",
    expectCost: "low",
  },
  {
    name: "UI 태그",
    input: { task_description: "대시보드 레이아웃 리팩터", tags: ["ui"] },
    expectPrimary: "Fable 5",
    expectCost: "medium-high",
  },
  {
    name: "아키텍처",
    input: {
      task_description: "결제 모듈 구조 설계와 기술 선택",
      tags: ["architecture"],
    },
    expectPrimary: "Grok 5.x",
    expectCost: "medium-high",
  },
  {
    name: "버그/CI",
    input: {
      task_description: "CI 실패 재현과 난해한 타입 에러",
      tags: ["bug"],
    },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
  },
  {
    name: "bug 태그 단독(키워드 없음)",
    input: { task_description: "neutral task xyz", tags: ["bug"] },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
  },
  {
    name: "test 태그 단독(키워드 없음)",
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
    expectPrimary: "Fable 5",
    expectStick: "switch",
  },
  {
    name: "token high bulk → cheaper primary",
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
    name: "token high hard-bug → Codex + Sonnet fallback",
    input: {
      task_description:
        "CI 실패 재현과 난해한 타입 에러 — 긴 로그·대량 스택트레이스 전체 분석",
      tags: ["bug"],
    },
    expectPrimary: "GPT-5 Codex",
    expectCost: "high",
    expectTokenRisk: "high",
    expectPreferCheaper: true,
    expectFallback: "Claude Sonnet",
  },
  {
    name: "token low i18n",
    input: { task_description: "로그인 문구 i18n 한 줄 수정" },
    expectPrimary: "Composer 2.5",
    expectTokenRisk: "low",
    expectPreferCheaper: false,
    expectFallback: "Composer 2.5",
  },
  {
    name: "cost_bias cheap UI → Sonnet primary",
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
    name: "project blocked Codex",
    input: {
      task_description: "CI 실패 재현과 난해한 타입 에러",
      tags: ["bug"],
      project_config: { blocked_models: ["GPT-5 Codex"] },
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
    (c.expectFallback == null ||
      r.cheaper_fallback.name === c.expectFallback);
  const estimateOk =
    !!r.usage_estimate?.en &&
    !!r.usage_estimate?.ko &&
    !!r.recommendation_id &&
    r.primary_cost_tier === COST_TIER[r.primary] &&
    r.alternative_cost_tier === COST_TIER[r.alternative] &&
    r.primary_tier === MODEL_TIER[r.primary] &&
    r.alternative_tier === MODEL_TIER[r.alternative] &&
    typeof r.prefer_cheaper === "boolean" &&
    !!r.token_risk;
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
    estimateOk &&
    keepSilentOk;
  const mark = ok ? "OK" : "FAIL";
  console.log(
    `[${mark}] ${c.name}: primary=${r.primary} slug=${r.primary_slug} alt=${r.alternative}` +
      ` cost=${r.primary_cost_tier} tier=${r.primary_tier}` +
      ` risk=${r.token_risk} prefer_cheaper=${r.prefer_cheaper}` +
      ` fallback=${r.cheaper_fallback?.name}` +
      (r.stick_action ? ` stick=${r.stick_action}` : ""),
  );
  if (!ok) {
    failed += 1;
    console.error(
      `  expected primary=${c.expectPrimary}` +
        (c.expectStick ? ` stick=${c.expectStick}` : "") +
        (c.expectFallback ? ` fallback=${c.expectFallback}` : "") +
        `, got primary=${r.primary} stick=${r.stick_action ?? "(none)"}` +
        ` fallback=${r.cheaper_fallback?.name}` +
        ` risk=${r.token_risk} id=${r.recommendation_id}`,
    );
  }
}

for (const ex of EXAMPLE_PROMPTS) {
  const r = recommendModel({
    task_description: ex.ko,
    tags: ex.tags,
  });
  const ok =
    r.primary === ex.expected_primary &&
    !!r.primary_cost_tier &&
    !!r.usage_estimate?.en &&
    !!r.recommendation_id;
  console.log(
    `[${ok ? "OK" : "FAIL"}] example:${ex.category}: primary=${r.primary} cost=${r.primary_cost_tier} (expect ${ex.expected_primary})`,
  );
  if (!ok) {
    failed += 1;
    console.error(
      `  example ko=「${ex.ko.slice(0, 40)}…」 expected=${ex.expected_primary} got=${r.primary}`,
    );
  }
}

// Usage + alerts in temp dir
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-mcp-smoke-"));
const tmpUsage = path.join(tmpDir, "usage.jsonl");
const tmpSticky = path.join(tmpDir, "sticky.json");
const tmpFeedback = path.join(tmpDir, "feedback.jsonl");
const tmpProjectDir = path.join(tmpDir, "proj");
fs.mkdirSync(tmpProjectDir);

try {
  const a = logModelUsage(
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
  const weekSummary = getUsageSummary({
    path: tmpUsage,
    period: "week",
  });
  const alertOk =
    a.ok &&
    summary.total_today >= 6 &&
    summary.period === "day" &&
    Array.isArray(summary.alerts) &&
    summary.alerts.some((x) => x.code === "high_tier_today") &&
    summary.alerts[0]?.ko.includes("Composer") &&
    !!summary.report?.en &&
    !!summary.report?.ko &&
    summary.report.en.includes("Today") &&
    weekSummary.period === "week" &&
    weekSummary.report.ko.includes("이번 주") &&
    weekSummary.by_tier.high >= 5;
  console.log(
    `[${alertOk ? "OK" : "FAIL"}] usage alerts+report: alerts=${summary.alerts.length} codes=${summary.alerts.map((x) => x.code).join(",")} report=${summary.report.en.slice(0, 40)}…`,
  );
  extraChecks += 1;
  if (!alertOk) failed += 1;

  // start_session payload shape (sticky+usage+optional recommend) via same modules
  setSticky(
    { adopted_model: "Composer 2.5", host: "cursor" },
    { path: tmpSticky },
  );
  const stickyForSession = getSticky({ path: tmpSticky });
  const sessionUsage = getUsageSummary({ path: tmpUsage, period: "week" });
  const sessionRec = recommendModel({
    task_description: "로그인 문구 i18n 한 줄 수정",
    current_model: stickyForSession.sticky?.adopted_model,
  });
  const sessionOk =
    stickyForSession.sticky?.adopted_model === "Composer 2.5" &&
    !!sessionUsage.report?.ko &&
    sessionRec.primary === "Composer 2.5" &&
    sessionRec.stick_action === "keep";
  console.log(
    `[${sessionOk ? "OK" : "FAIL"}] start_session pieces: sticky+report+recommend`,
  );
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

  // Sticky file roundtrip
  const set = setSticky(
    {
      adopted_model: "Composer 2.5",
      host: "cursor",
      context_hint: "i18n patch",
    },
    { path: tmpSticky },
  );
  const got = getSticky({ path: tmpSticky });
  const stickFileOk =
    set.ok &&
    got.sticky?.adopted_model === "Composer 2.5" &&
    got.sticky?.host === "cursor";
  const cleared = clearSticky({ path: tmpSticky });
  const clearOk = cleared.cleared && getSticky({ path: tmpSticky }).sticky == null;
  console.log(
    `[${stickFileOk && clearOk ? "OK" : "FAIL"}] sticky file set/get/clear`,
  );
  extraChecks += 1;
  if (!(stickFileOk && clearOk)) failed += 1;

  // Project config
  const cfgPath = path.join(tmpProjectDir, ".compass-mcp.json");
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({
      preferred_host: "claude",
      cost_bias: "prefer_cheap",
      blocked_models: ["Grok 5.x"],
      usage_alert_thresholds: { high_tier_today: 2 },
    }),
    "utf8",
  );
  const loaded = loadProjectConfig({ startDir: tmpProjectDir });
  const cfgOk =
    loaded.found &&
    loaded.config.preferred_host === "claude" &&
    loaded.config.cost_bias === "prefer_cheap";
  const withHost = recommendModel({
    task_description: "로그인 문구 i18n 한 줄 수정",
    project_config: loaded.config,
  });
  const hostFromCfg = withHost.host === "claude";
  console.log(
    `[${cfgOk && hostFromCfg ? "OK" : "FAIL"}] project config load+host host=${withHost.host}`,
  );
  extraChecks += 1;
  if (!(cfgOk && hostFromCfg)) failed += 1;

  // Feedback
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
  console.log(
    `[${fbOk ? "OK" : "FAIL"}] feedback adjust: ${JSON.stringify(adj)}`,
  );
  extraChecks += 1;
  if (!fbOk) failed += 1;
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Host profiles
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
  const hostOk =
    cursor.host === "cursor" &&
    cursor.primary_id === cursor.primary_slug &&
    cursor.primary_cost_tier === "low" &&
    !!cursor.cheaper_fallback_slug &&
    claude.host === "claude" &&
    claude.primary === "GPT-5 Codex" &&
    claude.primary_id.includes("opus") &&
    claude.cheaper_fallback.name === "Claude Sonnet" &&
    openai.host === "openai" &&
    openai.primary === "Grok 5.x" &&
    generic.host === "generic" &&
    generic.primary_id === "role:mid";
  console.log(
    `[${hostOk ? "OK" : "FAIL"}] hosts: cursor=${cursor.primary_id} claude=${claude.primary_id} fallback=${claude.cheaper_fallback.name}`,
  );
  extraChecks += 1;
  if (!hostOk) failed += 1;
}

// prefer_cheaper fallback presence (Sonnet/Composer)
{
  const bulk = recommendModel({
    task_description:
      "전체 코드베이스 대량 리팩터 전부 — 모든 파일 일괄 rename·마이그레이션",
  });
  const uiCheap = recommendModel({
    task_description: "랜딩 페이지 화면 UX 다듬기",
    tags: ["ui"],
    project_config: { cost_bias: "prefer_cheaper" },
  });
  const hard = recommendModel({
    task_description: "CI 실패 재현과 난해한 타입 에러 — 긴 로그 전체 분석",
    tags: ["bug"],
  });
  const fbOk =
    bulk.prefer_cheaper &&
    bulk.primary === "Composer 2.5" &&
    bulk.cheaper_fallback.name === "Composer 2.5" &&
    uiCheap.prefer_cheaper &&
    uiCheap.primary === "Claude Sonnet" &&
    uiCheap.cheaper_fallback_slug === "composer-2.5-fast" &&
    hard.prefer_cheaper &&
    hard.primary === "GPT-5 Codex" &&
    hard.cheaper_fallback.name === "Claude Sonnet" &&
    hard.cheaper_fallback_slug === "claude-sonnet-5-thinking-high" &&
    hard.reason.includes("Composer < Sonnet");
  console.log(
    `[${fbOk ? "OK" : "FAIL"}] cheaper_fallback ladder: bulk=${bulk.cheaper_fallback.name} ui=${uiCheap.primary} hard=${hard.cheaper_fallback_slug}`,
  );
  extraChecks += 1;
  if (!fbOk) failed += 1;
}

// how_to_refresh_mcp
{
  const cursorKo = buildHowToRefreshMcp({ host: "cursor", locale: "ko" });
  const cursorEn = buildHowToRefreshMcp({ host: "cursor", locale: "en" });
  const claude = buildHowToRefreshMcp({ host: "claude", locale: "en" });
  const hint = mcpRefreshSessionHint();
  const refreshOk =
    cursorKo.host === "cursor" &&
    cursorKo.locale === "ko" &&
    cursorKo.steps.length >= 4 &&
    cursorKo.steps_ko.some((s) => s.includes("Tools & MCP")) &&
    cursorKo.steps_ko.some((s) => s.includes("Cmd+Shift+J")) &&
    cursorKo.steps_en.some((s) => s.includes("toggle OFF then ON")) &&
    cursorEn.locale === "en" &&
    cursorEn.steps[0]?.includes("Cmd+Shift+J") &&
    !!cursorKo.docs?.cursor_mcp?.includes("cursor.com/docs/mcp") &&
    cursorKo.expected_tools.includes("start_session") &&
    cursorKo.expected_tools.includes("how_to_refresh_mcp") &&
    EXPECTED_TOOL_NAMES.includes("how_to_refresh_mcp") &&
    claude.host === "claude" &&
    claude.steps_en.some((s) => /quit/i.test(s)) &&
    hint.tool === "how_to_refresh_mcp" &&
    hint.ko.includes("how_to_refresh_mcp");
  console.log(
    `[${refreshOk ? "OK" : "FAIL"}] how_to_refresh_mcp: host=${cursorKo.host} steps=${cursorKo.steps.length}`,
  );
  extraChecks += 1;
  if (!refreshOk) failed += 1;
}

const total = cases.length + EXAMPLE_PROMPTS.length + extraChecks;
if (failed > 0) {
  console.error(`smoke failed: ${failed}/${total}`);
  process.exit(1);
}
console.log(
  `smoke ok: ${total}/${total} (cases=${cases.length} examples=${EXAMPLE_PROMPTS.length} extra=${extraChecks})`,
);
