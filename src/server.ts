#!/usr/bin/env node
/**
 * compass-mcp (Compass MCP) — ChronoCode 모델 추천 MCP (stdio).
 * SSOT for scoring / tiers / token_risk / sticky / usage / project config / feedback.
 * Cursor rules only orchestrate tool call order — do not duplicate scoring there.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EXAMPLE_PROMPTS, EXAMPLE_PROMPTS_META } from "./examples.js";
import { getFeedbackAdjustments, logFeedback } from "./feedback.js";
import { listHostProfiles, resolveHostId } from "./hosts.js";
import {
  loadProjectConfig,
  PROJECT_CONFIG_SCHEMA_DOC,
} from "./projectConfig.js";
import { recommendModel, type Tag } from "./recommend.js";
import {
  buildHowToRefreshMcp,
  mcpRefreshSessionHint,
} from "./refreshHelp.js";
import { clearSticky, getSticky, setSticky } from "./sticky.js";
import { getUsageSummary, logModelUsage } from "./usage.js";

const SERVER_NAME = "compass-mcp";
const SERVER_VERSION = "0.4.0";
const refreshHostSchema = z
  .enum(["cursor", "claude", "openai", "vscode", "generic"])
  .optional();

const tagSchema = z.enum(["ui", "bug", "architecture", "test"]);
const categorySchema = z.enum([
  "ui",
  "bug",
  "architecture",
  "light_patch",
  "recommend_again",
]);
const hostSchema = z
  .enum(["cursor", "claude", "openai", "generic", "forge", "openclaw"])
  .optional();
const voteSchema = z.enum(["good", "bad"]);
const periodSchema = z.enum(["day", "week"]);
const localeSchema = z.enum(["en", "ko"]);

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

const startSessionArgs = {
  task_description: z
    .string()
    .optional()
    .describe("있으면 recommend_model 퀵 실행"),
  tags: z
    .array(tagSchema)
    .optional()
    .describe("선택: ui | bug | architecture | test"),
  host: hostSchema.describe("선택 host (없으면 project/env/cursor)"),
  cwd: z
    .string()
    .optional()
    .describe("프로젝트 설정·cwd (기본 process.cwd())"),
  period: periodSchema
    .optional()
    .describe("usage report 창: day | week (기본 week)"),
  locale: localeSchema
    .optional()
    .describe("report_text 언어: en | ko (기본 en; report 객체는 둘 다)"),
};

function buildStartSessionPayload(input: {
  task_description?: string;
  tags?: Tag[];
  host?: string;
  cwd?: string;
  period?: "day" | "week";
  locale?: "en" | "ko";
  alias_of?: string;
}) {
  const stickyRes = getSticky();
  const project = loadProjectConfig({ startDir: input.cwd });
  const usage = getUsageSummary({
    period: input.period ?? "week",
    alert_thresholds: project.config.usage_alert_thresholds,
  });
  const loc = input.locale ?? "en";
  let recommend: Record<string, unknown> | null = null;
  if (input.task_description?.trim()) {
    const feedback_adjust = getFeedbackAdjustments();
    const result = recommendModel({
      task_description: input.task_description,
      tags: input.tags,
      current_model: stickyRes.sticky?.adopted_model,
      host: input.host,
      project_config: project.config,
      feedback_adjust,
      usage_prefer_cheaper: usage.alerts.length > 0,
    });
    recommend = {
      primary: result.primary,
      alternative: result.alternative,
      reason: result.reason,
      recommendation_id: result.recommendation_id,
      host: result.host,
      primary_id: result.primary_id,
      alternative_id: result.alternative_id,
      primary_slug: result.primary_slug,
      primary_cost_tier: result.primary_cost_tier,
      primary_tier: result.primary_tier,
      token_risk: result.token_risk,
      prefer_cheaper: result.prefer_cheaper,
      cheaper_fallback: result.cheaper_fallback,
      cheaper_fallback_slug: result.cheaper_fallback_slug,
      usage_estimate: result.usage_estimate,
      ...(result.stick_action
        ? {
            stick_action: result.stick_action,
            sticky_suggest: result.sticky_suggest,
          }
        : {}),
    };
  }
  return {
    sticky: stickyRes.sticky,
    sticky_path: stickyRes.path,
    alerts: usage.alerts,
    report: usage.report,
    report_text: loc === "ko" ? usage.report.ko : usage.report.en,
    usage: {
      period: usage.period,
      by_model: usage.by_model,
      by_tier: usage.by_tier,
      total_today: usage.total_today,
      total_week: usage.total_week,
      today_by_tier: usage.today_by_tier,
      week_by_tier: usage.week_by_tier,
    },
    project_config_path: project.path,
    recommend,
    mcp_refresh: mcpRefreshSessionHint(),
    flow_hint:
      "After pick: log_model_usage → set_sticky. stick_action=keep → keep silent. Alerts: surface once per session. Stale tools → how_to_refresh_mcp.",
    note: "Prefer start_session at work start. Alias: session_check. After install/update, if tools look stale, call how_to_refresh_mcp.",
    ...(input.alias_of ? { alias_of: input.alias_of } : {}),
  };
}

function jsonToolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

server.tool(
  "how_to_refresh_mcp",
  "설치/업데이트 후 MCP 도구 목록이 안 바뀔 때 호스트별 새로고침 절차 (ko/en). Cursor: Tools & MCP 토글. host·locale 선택.",
  {
    host: refreshHostSchema.describe(
      "cursor | claude | openai | vscode | generic (기본 cursor)",
    ),
    locale: localeSchema
      .optional()
      .describe("ko | en (기본 ko — steps 주 언어; steps_en/steps_ko 둘 다 포함)"),
  },
  async ({ host, locale }) =>
    jsonToolResult(
      buildHowToRefreshMcp({
        host,
        locale: locale ?? "ko",
      }),
    ),
);

server.tool(
  "start_session",
  "작업 시작 한 번 호출: sticky + usage alerts(+ report) + (선택) task_description 있으면 quick recommend. session_check 별칭. 도구 목록이 옛것이면 how_to_refresh_mcp.",
  startSessionArgs,
  async (args) =>
    jsonToolResult(
      buildStartSessionPayload({
        ...args,
        tags: args.tags as Tag[] | undefined,
      }),
    ),
);

server.tool(
  "session_check",
  "Alias of start_session: sticky + usage alerts + optional quick recommend.",
  startSessionArgs,
  async (args) =>
    jsonToolResult(
      buildStartSessionPayload({
        ...args,
        tags: args.tags as Tag[] | undefined,
        alias_of: "start_session",
      }),
    ),
);

server.tool(
  "recommend_model",
  "작업 설명(+태그)으로 모델 추천. sticky·project·feedback·usage alerts 반영. token_risk·prefer_cheaper·cheaper_fallback(Sonnet/Composer)·recommendation_id 포함. Cursor UI 자동 전환 불가 — Task model slug만.",
  {
    task_description: z
      .string()
      .describe("할 일 요약 (한국어/영어 무관) — 필수"),
    tags: z
      .array(tagSchema)
      .optional()
      .describe("선택: ui | bug | architecture | test"),
    current_model: z
      .string()
      .optional()
      .describe(
        "sticky 오버라이드. 없으면 ~/.cursor/compass-mcp/sticky.json 의 adopted_model 사용",
      ),
    host: hostSchema.describe(
      "선택. 없으면 project preferred_host → COMPASS_MCP_HOST → cursor",
    ),
    cwd: z
      .string()
      .optional()
      .describe("프로젝트 설정 탐색 시작 디렉터리 (기본 process.cwd())"),
  },
  async ({ task_description, tags, current_model, host, cwd }) => {
    const stickyRes = getSticky();
    const project = loadProjectConfig({ startDir: cwd });
    const feedback_adjust = getFeedbackAdjustments();
    const usage = getUsageSummary({
      period: "week",
      alert_thresholds: project.config.usage_alert_thresholds,
    });
    const fromSticky = stickyRes.sticky?.adopted_model;
    const effectiveCurrent = current_model?.trim() || fromSticky;

    const result = recommendModel({
      task_description,
      tags: tags as Tag[] | undefined,
      current_model: effectiveCurrent,
      host,
      project_config: project.config,
      feedback_adjust,
      usage_prefer_cheaper: usage.alerts.length > 0,
    });

    const payload = {
      primary: result.primary,
      alternative: result.alternative,
      reason: result.reason,
      recommendation_id: result.recommendation_id,
      host: result.host,
      primary_id: result.primary_id,
      alternative_id: result.alternative_id,
      primary_slug: result.primary_slug,
      alternative_slug: result.alternative_slug,
      primary_cost_tier: result.primary_cost_tier,
      alternative_cost_tier: result.alternative_cost_tier,
      primary_tier: result.primary_tier,
      alternative_tier: result.alternative_tier,
      token_risk: result.token_risk,
      prefer_cheaper: result.prefer_cheaper,
      cheaper_fallback: result.cheaper_fallback,
      cheaper_fallback_slug: result.cheaper_fallback_slug,
      usage_estimate: result.usage_estimate,
      scores: result.scores,
      sticky_loaded: stickyRes.sticky,
      project_config_path: project.path,
      usage_alerts: usage.alerts,
      ...(result.stick_action
        ? {
            stick_action: result.stick_action,
            current_resolved: result.current_resolved,
            sticky_suggest: result.sticky_suggest,
          }
        : {}),
      note: "SSOT=compass-mcp. Chat UI auto-switch unavailable. Claude ladder: Composer < Sonnet < Opus < Fable/Codex. When prefer_cheaper, Task model=cheaper_fallback_slug (or Sonnet). Flow: get_sticky → recommend_model → log_model_usage → set_sticky.",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "get_sticky",
  "채택 모델 sticky 조회 (~/.cursor/compass-mcp/sticky.json).",
  {},
  async () => {
    const result = getSticky();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "set_sticky",
  "채택 모델 sticky 저장. recommend 후 / 「추천대로」 후 호출.",
  {
    adopted_model: z
      .string()
      .describe("표시명 또는 Task slug / host id"),
    host: z.string().optional().describe("선택: cursor|claude|openai|generic"),
    context_hint: z
      .string()
      .optional()
      .describe("선택: 짧은 맥락 (앱/버그/UI 등, 시크릿 금지)"),
  },
  async ({ adopted_model, host, context_hint }) => {
    const result = setSticky({ adopted_model, host, context_hint });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "clear_sticky",
  "sticky.json 삭제 (맥락 리셋).",
  {},
  async () => {
    const result = clearSticky();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "get_project_config",
  "cwd에서 상위로 .compass-mcp.json 탐색·로드. preferred_host·default_tier·blocked_models·cost_bias·alert thresholds.",
  {
    cwd: z
      .string()
      .optional()
      .describe("탐색 시작 디렉터리 (기본 process.cwd())"),
  },
  async ({ cwd }) => {
    const loaded = loadProjectConfig({ startDir: cwd });
    const payload = {
      ...loaded,
      schema: PROJECT_CONFIG_SCHEMA_DOC,
      note: "Place .compass-mcp.json in repo root. Soft prefs only — scoring SSOT remains recommend_model.",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "feedback_recommendation",
  "추천 피드백 good|bad → ~/.cursor/compass-mcp/feedback.jsonl. 가벼운 점수 보정에만 사용(과적합 금지).",
  {
    vote: voteSchema.describe("good | bad"),
    recommendation_id: z
      .string()
      .optional()
      .describe("recommend_model 이 준 recommendation_id"),
    primary: z.string().optional().describe("추천 primary 모델"),
    alternative: z.string().optional().describe("추천 alternative"),
    models: z
      .array(z.string())
      .optional()
      .describe("또는 [primary, alternative?]"),
    note: z
      .string()
      .optional()
      .describe("짧은 메모 (시크릿 금지)"),
  },
  async ({ vote, recommendation_id, primary, alternative, models, note }) => {
    const result = logFeedback({
      vote,
      recommendation_id,
      primary,
      alternative,
      models,
      note,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ...result,
              note: "Feedback is a tiny local nudge (±cap). Re-run recommend_model to see effect.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "list_example_prompts",
  "붙여넣을 예 문장(ko/en) + category + tags + expected_primary. 실제 recommend_model 스코어링과 맞춤.",
  {
    category: categorySchema
      .optional()
      .describe(
        "선택 필터: ui | bug | architecture | light_patch | recommend_again",
      ),
  },
  async ({ category }) => {
    const examples = category
      ? EXAMPLE_PROMPTS.filter((e) => e.category === category)
      : EXAMPLE_PROMPTS;
    const payload = {
      examples,
      meta: EXAMPLE_PROMPTS_META,
      note: "Paste ko or en into recommend_model.task_description (and tags when listed).",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "list_hosts",
  "Available host profiles (cursor/claude/openai/generic) + role→id maps including Claude Sonnet/Opus. Claude/OpenAI ids approximate — edit src/hosts.ts. Cursor: Task model fallback OK; UI dropdown does not auto-switch.",
  {},
  async () => {
    const payload = {
      default_host: resolveHostId(undefined),
      env_COMPASS_MCP_HOST:
        process.env.COMPASS_MCP_HOST ??
        process.env.MODEL_ROUTER_HOST ??
        null,
      hosts: listHostProfiles(),
      claude_ladder:
        "Composer < Sonnet < Opus < Fable/Codex (approx). Cursor Task can use cheaper_fallback_slug (Sonnet/Composer); chat UI dropdown still manual.",
      note: "Pass recommend_model.host or set COMPASS_MCP_HOST. forge/openclaw alias → generic. prefer_cheaper → Task model=cheaper_fallback_slug or Sonnet.",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "log_model_usage",
  "로컬 JSONL(~/.cursor/compass-mcp/usage.jsonl)에 모델 사용을 append. 시크릿·토큰 넣지 말 것. 서브에이전트 model 지정 직후 호출 권장.",
  {
    model: z
      .string()
      .describe("표시명 또는 Task slug / host id"),
    task_tag: z
      .string()
      .optional()
      .describe("선택: ui | bug | architecture | test | 짧은 태그"),
    note: z
      .string()
      .optional()
      .describe("선택: 짧은 메모 (시크릿 금지, 최대 ~200자)"),
  },
  async ({ model, task_tag, note }) => {
    const result = logModelUsage({ model, task_tag, note });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "get_usage_summary",
  "usage 집계 + friendly report (en/ko). period=day|week 선택. alerts[] (고비용 과다 시 Composer 안내). thresholds는 .compass-mcp.json.",
  {
    period: periodSchema
      .optional()
      .describe("day | week — report/by_model 초점 (기본 week)"),
    since_days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe("레거시: 1→day, 그 외 week. period 우선"),
    locale: localeSchema
      .optional()
      .describe("report_text 언어 en|ko (기본 en; report 객체는 둘 다)"),
    cwd: z
      .string()
      .optional()
      .describe("alert thresholds용 프로젝트 설정 탐색 cwd"),
  },
  async ({ period, since_days, locale, cwd }) => {
    const project = loadProjectConfig({ startDir: cwd });
    const summary = getUsageSummary({
      period,
      since_days,
      alert_thresholds: project.config.usage_alert_thresholds,
    });
    const loc = locale ?? "en";
    return jsonToolResult({
      ...summary,
      report_text: loc === "ko" ? summary.report.ko : summary.report.en,
      project_config_path: project.path,
      note: "Surface alerts once per session when non-empty — prefer Composer for routine work. Prefer start_session at work start.",
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err);
  process.exit(1);
});
