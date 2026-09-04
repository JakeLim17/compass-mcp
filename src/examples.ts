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
  // —— UI: Composer default; Fable only for layout refactor ——
  {
    category: "ui",
    ko: "대시보드 레이아웃 리팩터하고 히어로 섹션 CSS 정리해줘",
    en: "Refactor the dashboard layout and clean up the hero section CSS",
    tags: ["ui"],
    expected_primary: "Fable 5",
    note: "Layout refactor → Fable. Hero copy/font only (no refactor) → Composer.",
  },
  {
    category: "ui",
    ko: "랜딩 페이지 화면 UX 다듬고 컴포넌트 간격 맞춰줘",
    en: "Polish the landing page UX and align component spacing",
    tags: ["ui"],
    expected_primary: "Composer 2.5",
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
  // —— architecture → Grok (Cursor pool) first; Fable for UI-heavy design ——
  {
    category: "architecture",
    ko: "결제 모듈 구조 설계랑 기술 선택 트레이드오프 정리해줘",
    en: "Design the payment module structure and summarize tech-choice trade-offs",
    tags: ["architecture"],
    expected_primary: "Grok 5.x",
    expected_primaries: ["Grok 5.x", "Fable 5", "Claude Opus"],
    note: "Design/tradeoffs — Grok (Cursor pool) first; Fable when UI refactor involved.",
  },
  {
    category: "architecture",
    ko: "이 기능을 어떻게 짤지 아키텍처 의사결정만 먼저 해줘",
    en: "First decide the architecture for how we should build this feature",
    tags: ["architecture"],
    expected_primary: "Grok 5.x",
    expected_primaries: ["Grok 5.x", "Fable 5", "Claude Opus", "Claude Sonnet"],
  },
  {
    category: "architecture",
    ko: "간단 계획만 — 다음 스프린트 뭐 할지 짧게 정리",
    en: "Light plan only — briefly outline what to do next sprint",
    tags: ["architecture"],
    expected_primary: "Composer 2.5",
    expected_primaries: ["Composer 2.5", "Grok 5.x", "Claude Sonnet"],
    note: "Light planning → Composer/Grok may beat Other models.",
  },
  // —— light patch / copy → host lightest (Cursor=Composer, Claude=Haiku) ——
  {
    category: "light_patch",
    ko: "히어로 영어 슬로건 바꾸고 폰트 적용 고쳐줘",
    en: "Change the hero English slogan and fix font application",
    tags: ["ui"],
    expected_primary: "Composer 2.5",
    note: "UI keywords present but light copy/font → Composer, not Fable/Sonnet.",
  },
  {
    category: "light_patch",
    ko: "로그인 문구 i18n 한 줄만 수정해줘",
    en: "Fix one i18n string on the login page",
    expected_primary: "Composer 2.5",
    note: "Logical lightest role — primary_id varies: cursor=composer slug, claude=Haiku, openai=mini.",
  },
  {
    category: "light_patch",
    ko: "en-em 대시를 ASCII 하이픈으로만 바꿔줘",
    en: "Replace en/em dashes with ASCII hyphens only (copy-only punctuation)",
    expected_primary: "Composer 2.5",
    note: "Punctuation/hyphen-only → Composer Standard, not Grok/Fable.",
  },
  {
    category: "light_patch",
    ko: "타이포 주석 정리하고 lint 경고 작은 핫픽스만",
    en: "Tiny hotfix: tidy a typo comment and a small lint warning",
    expected_primary: "Composer 2.5",
  },
  {
    category: "architecture",
    ko: "전체 코드베이스 긴 컨텍스트로 구조 분석해줘",
    en: "Analyze the whole repo structure with long code context",
    tags: ["architecture"],
    expected_primary: "Kimi K2.7",
    expected_primaries: ["Kimi K2.7", "Grok 5.x", "Claude Sonnet"],
    note: "Long codebase read → Kimi; not Fable (multi-file UI only).",
  },
  {
    category: "architecture",
    ko: "초대형 마이크로서비스 설계 — 최고 난이도, 비싸도 됨",
    en: "Huge microservices design — maximum effort, premium OK",
    tags: ["architecture"],
    expected_primary: "Opus 5",
    expected_primaries: ["Opus 5", "Grok 5.x", "Fable 5"],
    note: "Extreme scope + premium → Opus 5 rarely wins.",
  },
  // —— recommend again ——
  {
    category: "recommend_again",
    ko: "모델 다시 추천해줘 — 이제 UI 작업에서 버그 디버그로 바꿨어",
    en: "Recommend a model again — we switched from UI work to bug debugging",
    tags: ["bug"],
    expected_primary: "GPT-5 Codex",
    note: "Context changed → recommend again; stick_action switch if current was UI/Composer.",
  },
  {
    category: "recommend_again",
    ko: "같은 대시보드 레이아웃 리팩터 작업 이어서 — 모델 또 물어볼 필요 있어?",
    en: "Continuing the same dashboard layout refactor — do I need to ask for a model again?",
    tags: ["ui"],
    expected_primary: "Fable 5",
    note: "Same dashboard layout refactor context → keep Fable.",
  },
];

export const EXAMPLE_PROMPTS_META = {
  model_persistence:
    "Same kind of work → keep the adopted model (no re-ask). Task type changed → call recommend_model again; on switch, tell the user via model_persistence (not the word sticky).",
  save_vs_quality:
    "Default: Cursor pool first (Composer + Grok). Copy/i18n/hyphen→Composer, layout UI refactor→Fable, design/plan→Grok, hard bug→Codex. Other(Sonnet/Opus/GPT) only when needed.",
  design_primary_varies:
    "Design/planning primary is Grok (Cursor pool) first — not fixed to Fable/Sonnet. unavailable on host → candidates[1].",
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
