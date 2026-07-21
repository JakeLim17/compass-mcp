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
  /** Expected primary after scoring (hint for agents / docs) */
  expected_primary: ModelId;
  /** Optional sticky note for this example */
  note?: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  // —— UI → Fable 5 ——
  {
    category: "ui",
    ko: "대시보드 레이아웃 리팩터하고 히어로 섹션 CSS 정리해줘",
    en: "Refactor the dashboard layout and clean up the hero section CSS",
    tags: ["ui"],
    expected_primary: "Fable 5",
  },
  {
    category: "ui",
    ko: "랜딩 페이지 화면 UX 다듬고 컴포넌트 간격 맞춰줘",
    en: "Polish the landing page UX and align component spacing",
    tags: ["ui"],
    expected_primary: "Fable 5",
  },
  // —— bug → GPT-5 Codex ——
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
  // —— architecture → Grok 5.x ——
  {
    category: "architecture",
    ko: "결제 모듈 구조 설계랑 기술 선택 트레이드오프 정리해줘",
    en: "Design the payment module structure and summarize tech-choice trade-offs",
    tags: ["architecture"],
    expected_primary: "Grok 5.x",
  },
  {
    category: "architecture",
    ko: "이 기능을 어떻게 짤지 아키텍처 의사결정만 먼저 해줘",
    en: "First decide the architecture for how we should build this feature",
    tags: ["architecture"],
    expected_primary: "Grok 5.x",
  },
  // —— light patch / i18n → Composer 2.5 ——
  {
    category: "light_patch",
    ko: "로그인 문구 i18n 한 줄만 수정해줘",
    en: "Fix one i18n string on the login page",
    expected_primary: "Composer 2.5",
  },
  {
    category: "light_patch",
    ko: "타이포 주석 정리하고 lint 경고 작은 핫픽스만",
    en: "Tiny hotfix: tidy a typo comment and a small lint warning",
    expected_primary: "Composer 2.5",
  },
  // —— recommend again (sticky / context shift) ——
  {
    category: "recommend_again",
    ko: "모델 다시 추천해줘 — 이제 UI 작업에서 버그 디버그로 바꿨어",
    en: "Recommend a model again — we switched from UI work to bug debugging",
    tags: ["bug"],
    expected_primary: "GPT-5 Codex",
    note: "Context changed → call recommend_model again; expect stick_action switch if current_model was UI/Fable.",
  },
  {
    category: "recommend_again",
    ko: "같은 대시보드 레이아웃 작업 이어서 — 모델 또 물어볼 필요 있어?",
    en: "Continuing the same dashboard layout work — do I need to ask for a model again?",
    tags: ["ui"],
    expected_primary: "Fable 5",
    note: "Same context → sticky keep; do not re-ask the user. Optionally pass current_model.",
  },
];

export const EXAMPLE_PROMPTS_META = {
  sticky:
    "Same context = keep adopted model (no re-ask). Context / task-type change = call recommend_model again and present primary + alternative on switch.",
  honest_limit:
    "This MCP does not auto-switch the Cursor chat UI model. You still pick the chat model or pass a Task model slug.",
  categories: [
    "ui",
    "bug",
    "architecture",
    "light_patch",
    "recommend_again",
  ] as ExampleCategory[],
};
