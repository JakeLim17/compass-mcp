/**
 * Paste-ready example prompts for README + list_example_prompts.
 * expected_primary matches recommend.ts scoring (tags + keywords).
 */
import type { ModelId, Tag } from "./recommend.js";

export type ExampleCategory =
  | "ui"
  | "bug"
  | "architecture"
  | "light_patch"
  | "recommend_again";

export interface ExamplePrompt {
  category: ExampleCategory;
  /** Korean — users may paste as-is */
  ko: string;
  /** English equivalent */
  en: string;
  /** Suggested tags for recommend_model */
  tags?: Tag[];
  /** Expected primary after scoring (hint — design may vary by scope) */
  expected_primary: ModelId;
  /** When primary varies by heuristics (e.g. design/planning) */
  expected_primaries?: ModelId[];
  /** Optional note for this example */
  note?: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  // —— UI → Sonnet (default save; Fable only for large redesign / premium) ——
  {
    category: "ui",
    ko: "대시보드 레이아웃 리팩터하고 히어로 섹션 CSS 정리해줘",
    en: "Refactor the dashboard layout and clean up the hero section CSS",
    tags: ["ui"],
    expected_primary: "Claude Sonnet",
    note: "Save default → Sonnet. Quality expect / large redesign / premium → Fable (not the cheap primary).",
  },
  {
    category: "ui",
    ko: "랜딩 페이지 화면 UX 다듬고 컴포넌트 간격 맞춰줘",
    en: "Polish the landing page UX and align component spacing",
    tags: ["ui"],
    expected_primary: "Claude Sonnet",
  },
  // —— bug → GPT-5 Codex (Terra) ——
  {
    category: "bug",
    ko: "CI 실패 재현해서 난해한 타입 에러 원인 찾아줘",
    en: "Reproduce the CI failure and find the tricky type-error root cause",
    tags: ["bug"],
    expected_primary: "GPT-5 Codex",
  },
  {
    category: "bug",
    ko: "플레이키한 회귀 버그 디버그하고 테스트로 고정해줘",
    en: "Debug a flaky regression bug and lock it down with a test",
    tags: ["bug"],
    expected_primary: "GPT-5 Codex",
  },
  // —— architecture → Fable/Grok/Opus/Sonnet compete (not Claude-only) ——
  {
    category: "architecture",
    ko: "결제 모듈 구조 설계랑 기술 선택 트레이드오프 정리해줘",
    en: "Design the payment module structure and summarize tech-choice trade-offs",
    tags: ["architecture"],
    expected_primary: "Fable 5",
    expected_primaries: ["Fable 5", "Grok 5.x", "Claude Opus"],
    note: "Broad tradeoffs — Fable/Grok/Opus often win; not vendor-locked.",
  },
  {
    category: "architecture",
    ko: "이 기능을 어떻게 짤지 아키텍처 의사결정만 먼저 해줘",
    en: "First decide the architecture for how we should build this feature",
    tags: ["architecture"],
    expected_primary: "Fable 5",
    expected_primaries: ["Fable 5", "Grok 5.x", "Claude Opus", "Claude Sonnet"],
  },
  {
    category: "architecture",
    ko: "간단 계획만 — 다음 스프린트 뭐 할지 짧게 정리",
    en: "Light plan only — briefly outline what to do next sprint",
    tags: ["architecture"],
    expected_primary: "Claude Sonnet",
    expected_primaries: ["Claude Sonnet", "Composer 2.5", "Fable 5"],
    note: "Light planning → Sonnet/Composer may beat Fable.",
  },
  // —— light patch / copy → host lightest (Cursor=Composer, Claude=Haiku) ——
  {
    category: "light_patch",
    ko: "로그인 문구 i18n 한 줄만 수정해줘",
    en: "Fix one i18n string on the login page",
    expected_primary: "Composer 2.5",
    note: "Logical lightest role — primary_id varies: cursor=composer slug, claude=Haiku, openai=mini.",
  },
  {
    category: "light_patch",
    ko: "타이포 주석 정리하고 lint 경고 작은 핫픽스만",
    en: "Tiny hotfix: tidy a typo comment and a small lint warning",
    expected_primary: "Composer 2.5",
  },
  // —— recommend again ——
  {
    category: "recommend_again",
    ko: "모델 다시 추천해줘 — 이제 UI 작업에서 버그 디버그로 바꿨어",
    en: "Recommend a model again — we switched from UI work to bug debugging",
    tags: ["bug"],
    expected_primary: "GPT-5 Codex",
    note: "Context changed → recommend again; stick_action switch if current was UI/Sonnet.",
  },
  {
    category: "recommend_again",
    ko: "같은 대시보드 레이아웃 작업 이어서 — 모델 또 물어볼 필요 있어?",
    en: "Continuing the same dashboard layout work — do I need to ask for a model again?",
    tags: ["ui"],
    expected_primary: "Claude Sonnet",
    note: "Same context → keep model; do not re-ask. Agents: don’t paste full MCP dumps.",
  },
];

export const EXAMPLE_PROMPTS_META = {
  model_persistence:
    "Same kind of work → keep the adopted model (no re-ask). Task type changed → call recommend_model again; on switch, tell the user via model_persistence (not the word sticky).",
  save_vs_quality:
    "Default avoids overspend — copy/i18n→host lightest, small patch→lightest, design competes (Fable/Grok/Opus/Sonnet), hard bug→Codex.",
  design_primary_varies:
    "Design/planning primary is NOT fixed to Claude/Fable — scope & keywords pick among Fable, Grok, Opus, Sonnet. unavailable on host → candidates[1].",
  reading_recommendation:
    "primary / for_task = task recommendation only. The agent or Task worker that called this MCP (e.g. Composer) may differ — check clarity.ko in recommend_model.",
  honest_limit:
    "This MCP does not auto-switch the Cursor chat UI model. The runner that invoked the tool may differ from the task recommendation (primary / for_task). You still pick the chat model or pass a Task model slug.",
  categories: [
    "ui",
    "bug",
    "architecture",
    "light_patch",
    "recommend_again",
  ] as ExampleCategory[],
};
