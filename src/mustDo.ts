/**
 * Agent must_do checklist — shared by compact recommend + compliance verify.
 */
import type { RecommendResult } from "./recommend.js";

export interface MustDoChecklist {
  task_model: string;
  fallback_model: string;
  ko: string[];
  en: string[];
}

export function buildMustDo(result: RecommendResult): MustDoChecklist {
  const fallback =
    result.candidates[1]?.id ??
    result.candidates[1]?.slug ??
    result.cheaper_fallback_slug;
  return {
    task_model: result.primary_id,
    fallback_model: fallback,
    ko: [
      `Task/subagent model=${result.primary_id}`,
      `unavailable → ${fallback}`,
      "log_model_usage → set_sticky",
      "주인님껀 model_persistence만 (sticky 단어 금지)",
    ],
    en: [
      `Task/subagent model=${result.primary_id}`,
      `if unavailable → ${fallback}`,
      "log_model_usage → set_sticky",
      "Tell user via model_persistence only — never say sticky",
    ],
  };
}
