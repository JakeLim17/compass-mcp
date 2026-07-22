/**
 * Detect explicit model requests in task_description (주인님 말 지정).
 * Takes priority over task scoring when a directive pattern matches.
 */

export type VerbalModelId =
  | "Composer 2.5"
  | "Claude Sonnet"
  | "Claude Opus"
  | "Fable 5"
  | "Grok 5.x"
  | "GPT-5 Sol"
  | "GPT-5 Codex";

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

const VERBAL_SUFFIX =
  "(?:로|으로)?(?:\\s*(?:해보자|해줘|써|돌리|해|돌려|써봐|써줘|해봐|해\\s*줘|해\\s*봐|돌려\\s*줘|돌려\\s*봐|돌려봐|돌려줘|해보자|해줘|써|돌리|해))?";

const RULES: VerbalRule[] = [
  {
    model: "Fable 5",
    label: "Fable",
    ko: new RegExp(`(?:페이블${VERBAL_SUFFIX}|fable${VERBAL_SUFFIX})`, "i"),
    en: /\b(?:use|with)\s+fable\b/i,
  },
  {
    model: "GPT-5 Codex",
    label: "Codex",
    ko: new RegExp(
      `(?:코덱스${VERBAL_SUFFIX}|(?:terra|테라)${VERBAL_SUFFIX}|codex${VERBAL_SUFFIX})`,
      "i",
    ),
    en: /\b(?:use|with)\s+(?:codex|terra)\b/i,
  },
  {
    model: "Composer 2.5",
    label: "Composer",
    ko: new RegExp(`(?:컴포저${VERBAL_SUFFIX}|composer${VERBAL_SUFFIX})`, "i"),
    en: /\b(?:use|with)\s+composer\b/i,
  },
  {
    model: "Grok 5.x",
    label: "Grok",
    ko: new RegExp(`(?:그록${VERBAL_SUFFIX}|grok${VERBAL_SUFFIX})`, "i"),
    en: /\b(?:use|with)\s+grok\b/i,
  },
  {
    model: "Claude Sonnet",
    label: "Sonnet",
    ko: new RegExp(`(?:소넷${VERBAL_SUFFIX}|sonnet${VERBAL_SUFFIX})`, "i"),
    en: /\b(?:use|with)\s+sonnet\b/i,
  },
  {
    model: "Claude Opus",
    label: "Opus",
    ko: new RegExp(`(?:오퍼스${VERBAL_SUFFIX}|opus${VERBAL_SUFFIX})`, "i"),
    en: /\b(?:use|with)\s+opus\b/i,
  },
  {
    model: "GPT-5 Sol",
    label: "Sol",
    ko: new RegExp(`(?:\\b솔${VERBAL_SUFFIX}|\\bsol${VERBAL_SUFFIX})`, "i"),
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
