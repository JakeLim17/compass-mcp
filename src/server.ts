#!/usr/bin/env node
/**
 * compass-mcp — ChronoCode model recommendation MCP (stdio).
 * Purpose: pick the smallest catalog model that fits the command (save tokens).
 * Default responses are compact (verbose=false).
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
import {
  compactRecommendResult,
  recommendModel,
  type Tag,
} from "./recommend.js";
import {
  buildHowToRefreshMcp,
  mcpRefreshSessionHint,
} from "./refreshHelp.js";
import { clearSticky, getSticky, setSticky } from "./sticky.js";
import { getUsageSummary, logModelUsage } from "./usage.js";

const SERVER_NAME = "compass-mcp";
const SERVER_VERSION = "0.5.1";
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

const verboseSchema = z
  .boolean()
  .optional()
  .describe("true면 긴 필드 포함. 기본 false(짧은 JSON)");

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
    .describe("usage 창: day | week (기본 week; compact에선 카운트만)"),
  locale: localeSchema.optional().describe("verbose report 언어"),
  verbose: verboseSchema,
  include_report: z
    .boolean()
    .optional()
    .describe("true면 주간/일간 report 포함. 기본 false"),
};

function jsonToolResult(payload: unknown, pretty = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: pretty
          ? JSON.stringify(payload, null, 2)
          : JSON.stringify(payload),
      },
    ],
  };
}

function buildStartSessionPayload(input: {
  task_description?: string;
  tags?: Tag[];
  host?: string;
  cwd?: string;
  period?: "day" | "week";
  locale?: "en" | "ko";
  verbose?: boolean;
  include_report?: boolean;
  alias_of?: string;
}) {
  const verbose = !!input.verbose;
  const includeReport = !!input.include_report || verbose;
  const stickyRes = getSticky();
  const project = loadProjectConfig({ startDir: input.cwd });
  const usage = getUsageSummary({
    period: input.period ?? "week",
    alert_thresholds: project.config.usage_alert_thresholds,
  });
  let recommend: Record<string, unknown> | null = null;
  if (input.task_description?.trim()) {
    const result = recommendModel({
      task_description: input.task_description,
      tags: input.tags,
      current_model: stickyRes.sticky?.adopted_model,
      host: input.host,
      project_config: project.config,
      feedback_adjust: getFeedbackAdjustments(),
      usage_prefer_cheaper: usage.alerts.length > 0,
    });
    recommend = verbose
      ? {
          ...compactRecommendResult(result),
          cheaper_fallback: result.cheaper_fallback,
          usage_estimate: result.usage_estimate,
          scores: result.scores,
        }
      : compactRecommendResult(result);
  }

  if (!verbose) {
    return {
      sticky: stickyRes.sticky?.adopted_model ?? null,
      stick_action: recommend?.stick_action,
      alerts: usage.alerts.map((a) => a.code),
      usage: {
        period: usage.period,
        total_today: usage.total_today,
        by_tier: usage.by_tier,
      },
      recommend,
      tip: "Agents: summarize clarity.ko + cost_preview.advice.ko; don’t paste MCP dumps. primary/for_task ≠ caller model.",
      ...(input.alias_of ? { alias_of: input.alias_of } : {}),
      ...(includeReport
        ? {
            report:
              (input.locale ?? "en") === "ko"
                ? usage.report.ko
                : usage.report.en,
          }
        : {}),
    };
  }

  const loc = input.locale ?? "en";
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
    },
    project_config_path: project.path,
    recommend,
    mcp_refresh: mcpRefreshSessionHint(),
    tip: "Prefer compact start_session. Weekly report: include_report=true or get_usage_summary.",
    ...(input.alias_of ? { alias_of: input.alias_of } : {}),
  };
}

server.tool(
  "how_to_refresh_mcp",
  "MCP 새로고침 절차 (짧게). verbose=true면 전체 steps.",
  {
    host: refreshHostSchema.describe("cursor | claude | openai | vscode | generic"),
    locale: localeSchema.optional().describe("ko | en (기본 ko)"),
    verbose: verboseSchema,
  },
  async ({ host, locale, verbose }) => {
    const full = buildHowToRefreshMcp({
      host,
      locale: locale ?? "ko",
    });
    if (verbose) return jsonToolResult(full);
    return jsonToolResult({
      host: full.host,
      steps: (full.steps_ko ?? full.steps).slice(0, 4),
      docs: full.docs?.cursor_mcp,
    });
  },
);

server.tool(
  "start_session",
  "작업 시작(compact): sticky + alert codes + optional recommend. 주간 report는 include_report/verbose.",
  startSessionArgs,
  async (args) =>
    jsonToolResult(
      buildStartSessionPayload({
        ...args,
        tags: args.tags as Tag[] | undefined,
      }),
      !!args.verbose,
    ),
);

server.tool(
  "session_check",
  "Alias of start_session (compact).",
  startSessionArgs,
  async (args) =>
    jsonToolResult(
      buildStartSessionPayload({
        ...args,
        tags: args.tags as Tag[] | undefined,
        alias_of: "start_session",
      }),
      !!args.verbose,
    ),
);

server.tool(
  "recommend_model",
  "명령 문장 정독 → 최소 적합 모델(절약 기본). compact JSON. verbose=true면 scores 등. catalog-only + fallback_chain.",
  {
    task_description: z.string().describe("할 일 문장 — 의도·범위·난이도 포함해서"),
    tags: z.array(tagSchema).optional().describe("ui | bug | architecture | test"),
    current_model: z
      .string()
      .optional()
      .describe("sticky 오버라이드. 없으면 sticky.json"),
    host: hostSchema.describe("없으면 project/env/cursor"),
    cwd: z.string().optional().describe("project config 탐색 cwd"),
    verbose: verboseSchema,
  },
  async ({ task_description, tags, current_model, host, cwd, verbose }) => {
    const stickyRes = getSticky();
    const project = loadProjectConfig({ startDir: cwd });
    const usage = getUsageSummary({
      period: "week",
      alert_thresholds: project.config.usage_alert_thresholds,
    });
    const result = recommendModel({
      task_description,
      tags: tags as Tag[] | undefined,
      current_model: current_model?.trim() || stickyRes.sticky?.adopted_model,
      host,
      project_config: project.config,
      feedback_adjust: getFeedbackAdjustments(),
      usage_prefer_cheaper: usage.alerts.length > 0,
    });

    if (!verbose) {
      return jsonToolResult(compactRecommendResult(result));
    }
    return jsonToolResult(
      {
        ...compactRecommendResult(result),
        alternative_slug: result.alternative_slug,
        cheaper_fallback: result.cheaper_fallback,
        primary_cost_tier: result.primary_cost_tier,
        primary_tier: result.primary_tier,
        usage_estimate: result.usage_estimate,
        scores: result.scores,
        sticky_loaded: stickyRes.sticky?.adopted_model ?? null,
        usage_alerts: usage.alerts.map((a) => a.code),
        note: "Save tokens: smallest catalog model that fits. Task model=cheaper_fallback_slug when prefer_cheaper; unavailable→fallback_chain.",
      },
      true,
    );
  },
);

server.tool(
  "get_sticky",
  "채택 모델 sticky 조회.",
  { verbose: verboseSchema },
  async ({ verbose }) => {
    const result = getSticky();
    if (!verbose) {
      return jsonToolResult({
        adopted_model: result.sticky?.adopted_model ?? null,
        host: result.sticky?.host ?? null,
      });
    }
    return jsonToolResult(result, true);
  },
);

server.tool(
  "set_sticky",
  "채택 모델 sticky 저장.",
  {
    adopted_model: z.string().describe("표시명 또는 Task slug"),
    host: hostSchema,
    context_hint: z.string().optional(),
  },
  async ({ adopted_model, host, context_hint }) => {
    const result = setSticky({
      adopted_model,
      host: host ? resolveHostId(host) : undefined,
      context_hint,
    });
    return jsonToolResult({
      ok: result.ok,
      adopted_model: result.sticky?.adopted_model,
    });
  },
);

server.tool(
  "clear_sticky",
  "sticky 삭제.",
  {},
  async () => jsonToolResult(clearSticky()),
);

server.tool(
  "get_project_config",
  "`.compass-mcp.json` 로드 (기본 cost_bias=cheap).",
  {
    cwd: z.string().optional(),
    verbose: verboseSchema,
  },
  async ({ cwd, verbose }) => {
    const loaded = loadProjectConfig({ startDir: cwd });
    if (!verbose) {
      return jsonToolResult({
        found: loaded.found,
        cost_bias: loaded.config.cost_bias ?? "cheap(default)",
        blocked: loaded.config.blocked_models ?? [],
        unavailable: loaded.config.unavailable_models ?? [],
      });
    }
    return jsonToolResult(
      { ...loaded, schema: PROJECT_CONFIG_SCHEMA_DOC },
      true,
    );
  },
);

server.tool(
  "feedback_recommendation",
  "추천 good/bad 피드백 (로컬 미세 가산).",
  {
    vote: voteSchema,
    primary: z.string().optional(),
    alternative: z.string().optional(),
    models: z.array(z.string()).optional(),
    recommendation_id: z.string().optional(),
    note: z.string().optional(),
  },
  async (input) =>
    jsonToolResult({
      ok: logFeedback(input).ok,
      adjust: getFeedbackAdjustments(),
    }),
);

server.tool(
  "list_example_prompts",
  "예 문장 (compact).",
  {
    category: categorySchema.optional(),
    verbose: verboseSchema,
  },
  async ({ category, verbose }) => {
    const list = category
      ? EXAMPLE_PROMPTS.filter((e) => e.category === category)
      : EXAMPLE_PROMPTS;
    if (!verbose) {
      return jsonToolResult({
        meta: {
          reading: EXAMPLE_PROMPTS_META.reading_recommendation,
        },
        prompts: list.map((e) => ({
          category: e.category,
          ko: e.ko,
          expected: e.expected_primary,
          tags: e.tags,
        })),
      });
    }
    return jsonToolResult({ meta: EXAMPLE_PROMPTS_META, prompts: list }, true);
  },
);

server.tool(
  "list_hosts",
  "host 프로필 + Cursor 사다리 (compact).",
  { verbose: verboseSchema },
  async ({ verbose }) => {
    const hosts = listHostProfiles();
    if (!verbose) {
      const cursor = hosts.find((h) => h.id === "cursor");
      return jsonToolResult({
        cursor_ids: cursor?.ids,
        ladders: cursor?.ladders,
      });
    }
    return jsonToolResult({ hosts }, true);
  },
);

server.tool(
  "log_model_usage",
  "usage JSONL append (시크릿 금지).",
  {
    model: z.string(),
    task_tag: z.string().optional(),
    note: z.string().optional(),
  },
  async (input) => {
    const r = logModelUsage(input);
    return jsonToolResult({ ok: r.ok, model: r.entry.model });
  },
);

server.tool(
  "get_usage_summary",
  "usage 요약. 기본 compact(카운트+alerts). report는 verbose 또는 locale 지정 시.",
  {
    period: periodSchema.optional(),
    since_days: z.number().int().min(1).max(365).optional(),
    locale: localeSchema.optional(),
    verbose: verboseSchema,
    cwd: z.string().optional(),
  },
  async ({ period, since_days, locale, verbose, cwd }) => {
    const project = loadProjectConfig({ startDir: cwd });
    const summary = getUsageSummary({
      period: period ?? "week",
      since_days,
      alert_thresholds: project.config.usage_alert_thresholds,
    });
    if (!verbose && !locale) {
      return jsonToolResult({
        period: summary.period,
        by_tier: summary.by_tier,
        total_today: summary.total_today,
        alerts: summary.alerts.map((a) => ({ code: a.code, ko: a.ko })),
      });
    }
    const loc = locale ?? "en";
    return jsonToolResult(
      {
        period: summary.period,
        by_model: summary.by_model,
        by_tier: summary.by_tier,
        total_today: summary.total_today,
        total_week: summary.total_week,
        alerts: summary.alerts,
        report_text: loc === "ko" ? summary.report.ko : summary.report.en,
        ...(verbose ? { report: summary.report } : {}),
      },
      !!verbose,
    );
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
