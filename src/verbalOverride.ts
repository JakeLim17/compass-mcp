/**
 * Detect explicit model requests in task_description (주인님 말 지정).
 * Takes priority over task scoring when a directive pattern matches.
 */

export type VerbalModelId =
  | "Composer 2.5"
  | "Claude Sonnet"
  | "Claude Opus"
  | "Opus 5"
  | "Fable 5"
  | "Grok 5.x"
  | "GPT-5 Sol"
  | "GPT-5 Codex"
  | "Kimi K2.7";

export interface VerbalOverrideResult {
  model: VerbalModelId;
  /** Short label for clarity.ko, e.g. "Fable" */
  label: string;
}

type VerbalRule = {
  model: VerbalModelId;
  label: string;
  /** Korean / mixed directive: alias + (로|으로) + optional verb */
  ko?: RegExp;
  /** English: use fable, with codex */
  en?: RegExp;
};

/** Optional trailing polite verb after (로|으로) — not bare model name in prose/slugs */
const KO_TRAILING_VERB =
  "(?:\\s*(?:해보자|해줘|써|돌리|해|돌려|써봐|써줘|해봐|해\\s*줘|해\\s*봐|돌려\\s*줘|돌려\\s*봐|돌려봐|돌려줘))?";

/** Slug token — not a verbal directive when model name is part of an id */
const HYPHEN_PREFIX = "(?<![-\\w])";

/** Require (로|으로) or explicit 「써/돌려」 — avoids prose/slug false positive */
const KO_MODEL_DIRECTIVE = (alias: string, latin = false) =>
  new RegExp(
    latin
      ? `(?:${alias}(?:로|으로)${KO_TRAILING_VERB}|${HYPHEN_PREFIX}${alias}(?:로|으로)${KO_TRAILING_VERB}|(?:^|[\\s,.])${HYPHEN_PREFIX}${alias}\\s+(?:써|써줘|써봐|돌려|돌려줘|해\\s*줘|해봐))`
      : `(?:${alias}(?:로|으로)${KO_TRAILING_VERB}|(?:^|[\\s,.])${alias}\\s+(?:써|써줘|써봐|돌려|돌려줘|해\\s*줘|해봐))`,
    "i",
  );

const RULES: VerbalRule[] = [
  {
    model: "Fable 5",
    label: "Fable",
    ko: KO_MODEL_DIRECTIVE("(?:페이블|fable)", true),
    en: /\b(?:use|with)\s+fable\b/i,
  },
  {
    model: "GPT-5 Codex",
    label: "Codex",
    ko: KO_MODEL_DIRECTIVE("(?:코덱스|codex|terra|테라)", true),
    en: /\b(?:use|with)\s+(?:codex|terra)\b/i,
  },
  {
    model: "Composer 2.5",
    label: "Composer",
    ko: KO_MODEL_DIRECTIVE("(?:컴포저|composer)", true),
    en: /\b(?:use|with)\s+composer\b/i,
  },
  {
    model: "Grok 5.x",
    label: "Grok",
    ko: KO_MODEL_DIRECTIVE("(?:그록|grok)", true),
    en: /\b(?:use|with)\s+grok\b/i,
  },
  {
    model: "Claude Sonnet",
    label: "Sonnet",
    ko: KO_MODEL_DIRECTIVE("(?:소넷|sonnet)", true),
    en: /\b(?:use|with)\s+sonnet\b/i,
  },
  {
    model: "Opus 5",
    label: "Opus 5",
    ko: KO_MODEL_DIRECTIVE("(?:오퍼스\\s*5|opus\\s*5)", true),
    en: /\b(?:use|with)\s+opus\s*5\b/i,
  },
  {
    model: "Claude Opus",
    label: "Opus 4.8",
    ko: KO_MODEL_DIRECTIVE("(?:오퍼스|opus)", true),
    en: /\b(?:use|with)\s+opus\b/i,
  },
  {
    model: "Kimi K2.7",
    label: "Kimi",
    ko: KO_MODEL_DIRECTIVE("(?:키미|kimi)", true),
    en: /\b(?:use|with)\s+kimi\b/i,
  },
  {
    model: "GPT-5 Sol",
    label: "Sol",
    ko: KO_MODEL_DIRECTIVE("(?:솔|sol)", true),
    en: /\b(?:use|with)\s+sol\b/i,
  },
];

/** Detect verbal model directive in task text; null if none. */
export function detectVerbalModelRequest(text: string): VerbalOverrideResult | null {
  const t = text ?? "";
  if (!t.trim()) return null;

  for (const rule of RULES) {
    if (rule.en?.test(t)) {
      return { model: rule.model, label: rule.label };
    }
    if (rule.ko?.test(t)) {
      return { model: rule.model, label: rule.label };
    }
  }
  return null;
}

/** True when 주인님이 이번 턴만 모델을 말로 지정 — persistent sticky에 넣지 않음 */
export function isVerbalOneShotDirective(text: string): boolean {
  return detectVerbalModelRequest(text) != null;
}
