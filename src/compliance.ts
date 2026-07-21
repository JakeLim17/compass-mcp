/**
 * Agent run compliance — shrink “agent ignored the rules” risk.
 * Every compact recommend should carry must_do + run_hint; verify_run_compliance checks them.
 */
import type { MustDoChecklist } from "./mustDo.js";
import {
  recommendModel,
  compactRecommendResult,
  type Tag,
} from "./recommend.js";

export type { MustDoChecklist };

/** Short checklist agents must follow after recommend_model / start_session */
export { buildMustDo } from "./mustDo.js";

export interface ComplianceCheck {
  id: string;
  ok: boolean;
  detail?: string;
}

export interface ComplianceReport {
  ok: boolean;
  checks: ComplianceCheck[];
  missing: string[];
  mcp_version?: string;
}

const REQUIRED_COMPACT_KEYS = [
  "primary_id",
  "run_hint",
  "must_do",
  "mcp_version",
  "candidates",
  "fallback_chain",
  "agent_note",
] as const;

/** Validate a compact recommend payload (from recommend_model or start_session.recommend) */
export function verifyRecommendPayload(
  payload: Record<string, unknown>,
): ComplianceReport {
  const checks: ComplianceCheck[] = [];
  const missing: string[] = [];

  for (const key of REQUIRED_COMPACT_KEYS) {
    const present = key in payload && payload[key] != null;
    checks.push({ id: `has_${key}`, ok: present });
    if (!present) missing.push(key);
  }

  const primaryId = payload.primary_id;
  const runHint = payload.run_hint as
    | { ko?: string; task_model?: string }
    | undefined;
  const mustDo = payload.must_do as MustDoChecklist | undefined;
  const candidates = payload.candidates as unknown[] | undefined;

  checks.push({
    id: "run_hint_has_primary",
    ok:
      typeof primaryId === "string" &&
      !!runHint?.ko?.includes(primaryId) &&
      runHint?.task_model === primaryId,
  });
  checks.push({
    id: "must_do_task_model",
    ok: mustDo?.task_model === primaryId && (mustDo?.ko?.length ?? 0) >= 4,
  });
  checks.push({
    id: "must_do_no_sticky_word_to_user",
    ok:
      !!mustDo?.ko?.some((l) => l.includes("model_persistence")) &&
      !mustDo?.ko?.some((l) =>
        /^(tell user|주인님껀)\s+sticky/i.test(l.trim()),
      ),
  });
  checks.push({
    id: "candidates_min_2",
    ok: Array.isArray(candidates) && candidates.length >= 2,
  });
  checks.push({
    id: "mcp_version_semver",
    ok: typeof payload.mcp_version === "string" && /^\d+\.\d+\.\d+/.test(
      payload.mcp_version as string,
    ),
  });

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    checks,
    missing,
    mcp_version:
      typeof payload.mcp_version === "string"
        ? payload.mcp_version
        : undefined,
  };
}

/** Built-in scenario validation — smoke + verify_run_compliance share this */
export function verifyBuiltInScenarios(mcpVersion: string): ComplianceReport {
  const scenarios: Array<{ task_description: string; tags?: Tag[] }> = [
    { task_description: "로그인 문구 i18n 한 줄 수정" },
    {
      task_description: "CI 실패 재현과 난해한 타입 에러",
      tags: ["bug"],
    },
    { task_description: "대시보드 레이아웃 리팩터", tags: ["ui"] },
  ];

  const allChecks: ComplianceCheck[] = [];
  const missing = new Set<string>();

  for (const [i, input] of scenarios.entries()) {
    const result = recommendModel(input);
    const compact = compactRecommendResult(result, { mcp_version: mcpVersion });
    const report = verifyRecommendPayload(compact);
    for (const c of report.checks) {
      allChecks.push({
        id: `scenario_${i}_${c.id}`,
        ok: c.ok,
        detail: c.detail,
      });
    }
    for (const m of report.missing) missing.add(m);
  }

  return {
    ok: allChecks.every((c) => c.ok),
    checks: allChecks,
    missing: [...missing],
    mcp_version: mcpVersion,
  };
}
