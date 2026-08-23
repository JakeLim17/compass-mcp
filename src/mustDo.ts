/**
 * Agent must_do checklist — shared by compact recommend + compliance verify.
 * Cursor cannot auto-set Task.model — agents must copy task_model onto Task.
 */
import type { RecommendResult } from "./recommend.js";

export interface MustDoChecklist {
  task_model: string;
  fallback_model: string;
  /** Always true — omit Task.model = Composer leftover = violation */
  task_model_required: true;
  ko: string[];
  en: string[];
}

export function resolveFallbackModel(result: RecommendResult): string {
  return (
    result.candidates[1]?.id ??
    result.candidates[1]?.slug ??
    result.cheaper_fallback_slug
  );
}

export function buildMustDo(result: RecommendResult): MustDoChecklist {
  const fallback = resolveFallbackModel(result);
  const uiLine = result.ui_recommended_id
    ? `채팅 UI=${result.ui_recommended_id}(Standard, Fast 아님)`
    : result.ui_recommended_note?.ko
      ? result.ui_recommended_note.ko
      : null;
  return {
    task_model: result.primary_id,
    fallback_model: fallback,
    task_model_required: true,
    ko: [
      ...(uiLine ? [uiLine] : []),
      `Task.model=${result.primary_id} 필수`,
      "model 생략·말만 「추천으로 다시」=위반 (Composer 잔류)",
      `Multitask 부모도 model=${result.primary_id}`,
      `unavailable → ${fallback}`,
      "log_model_usage → set_sticky",
      "주인님껀 model_persistence만 (sticky 단어 금지)",
    ],
    en: [
      ...(result.ui_recommended_id
        ? [`chat UI=${result.ui_recommended_id} (Standard, not Fast)`]
        : result.ui_recommended_note?.en
          ? [result.ui_recommended_note.en]
          : []),
      `Task.model=${result.primary_id} required`,
      "Omitting model or talk-only switch = violation (Composer leftover)",
      `Multitask parent must also pass model=${result.primary_id}`,
      `if unavailable → ${fallback}`,
      "log_model_usage → set_sticky",
      "Tell user via model_persistence only — never say sticky",
    ],
  };
}
