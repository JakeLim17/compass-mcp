/**
 * Merge task_description with optional conversation context for classification.
 * Verbal model override still uses task-only text (recommend.ts).
 */

export const CONVERSATION_CONTEXT_MAX = 2000;

export interface MergedTaskContext {
  /** Current-turn user request (stripped of embedded context prefix) */
  task: string;
  /** Prior turns / summary (capped) */
  context: string;
  /** Full string passed to analyzeCommand / keyword scoring */
  classifyText: string;
  hasContext: boolean;
}

const EMBEDDED_CONTEXT_RE =
  /^\((?:문맥|context)[:：]\s*([\s\S]+?)\)\s*(?:→|->|-)\s*(?:이번[:：]\s*)?([\s\S]+)$/i;

/** Parse 「(문맥: …) → 이번: …」 embedded in task_description */
export function parseEmbeddedContextPrefix(rawTask: string): {
  task: string;
  embedded?: string;
} {
  const trimmed = (rawTask ?? "").trim();
  if (!trimmed) return { task: "" };
  const m = trimmed.match(EMBEDDED_CONTEXT_RE);
  if (m?.[1] && m[2]?.trim()) {
    return { task: m[2].trim(), embedded: m[1].trim() };
  }
  return { task: trimmed };
}

function capContext(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, CONVERSATION_CONTEXT_MAX);
}

/** Build classification text from task + optional MCP context fields */
export function mergeTaskContext(input: {
  task_description: string;
  conversation_context?: string;
  recent_turns?: string;
}): MergedTaskContext {
  const parsed = parseEmbeddedContextPrefix(input.task_description ?? "");
  const context = capContext([
    input.conversation_context ?? "",
    input.recent_turns ?? "",
    parsed.embedded ?? "",
  ]);
  const task = parsed.task;
  const classifyText = context ? `${context}\n---\n${task}` : task;
  return {
    task,
    context,
    classifyText,
    hasContext: context.length > 0,
  };
}
