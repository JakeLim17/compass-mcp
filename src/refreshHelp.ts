/**
 * Host-specific “how to refresh MCP” after install/update.
 * Cursor steps follow official docs (Tools & MCP toggle; no dedicated Refresh command).
 * @see https://cursor.com/docs/mcp.md
 * @see https://cursor.com/help/customization/mcp.md
 */

export type RefreshHost =
  | "cursor"
  | "claude"
  | "openai"
  | "vscode"
  | "generic";

export type RefreshLocale = "ko" | "en";

const REFRESH_HOSTS: RefreshHost[] = [
  "cursor",
  "claude",
  "openai",
  "vscode",
  "generic",
];

/** Tools that should be visible after a fresh install/update of compass-mcp. */
export const EXPECTED_TOOL_NAMES = [
  "start_session",
  "session_check",
  "how_to_refresh_mcp",
  "recommend_model",
  "get_sticky",
  "set_sticky",
  "clear_sticky",
  "get_usage_summary",
  "get_project_config",
  "log_model_usage",
  "feedback_recommendation",
  "list_example_prompts",
  "list_hosts",
] as const;

const DOCS = {
  cursor_mcp: "https://cursor.com/docs/mcp.md",
  cursor_help: "https://cursor.com/help/customization/mcp.md",
} as const;

type HostGuide = {
  host: RefreshHost;
  display_name: string;
  steps_en: string[];
  steps_ko: string[];
  notes_en: string[];
  notes_ko: string[];
};

const GUIDES: Record<RefreshHost, HostGuide> = {
  cursor: {
    host: "cursor",
    display_name: "Cursor",
    steps_en: [
      "Open Settings: Mac Cmd+Shift+J (Windows/Linux Ctrl+Shift+J) → Tools & MCP.",
      "Find compass-mcp / user-compass-mcp → toggle OFF then ON (or click ↻ refresh if shown).",
      "Optional: Cmd+Shift+P → search “MCP” / “Tools & MCP” (docs have no dedicated “MCP: Refresh” command).",
      "Still stale: quit Cursor fully and reopen. If needed, remove the server then re-add. Check MCP Logs via Cmd+Shift+U.",
    ],
    steps_ko: [
      "설정 열기: Mac Cmd+Shift+J (Windows/Linux Ctrl+Shift+J) → Tools & MCP.",
      "compass-mcp / user-compass-mcp 찾기 → 토글 OFF 후 ON (↻ 새로고침이 보이면 사용).",
      "선택: Cmd+Shift+P → “MCP” / “Tools & MCP” 검색 (문서에 전용 “MCP: Refresh” 명령은 없음).",
      "그래도 안 되면: Cursor 완전 종료 후 재실행. 필요 시 서버 제거 후 재추가. MCP 로그는 Cmd+Shift+U.",
    ],
    notes_en: [
      "Official troubleshooting uses toggle (or remove → re-add), not a named Refresh button.",
      `Docs: ${DOCS.cursor_mcp} · ${DOCS.cursor_help}`,
    ],
    notes_ko: [
      "공식 트러블슈팅은 토글(또는 제거→재추가)이며, Refresh 버튼 이름은 문서에 없음.",
      `문서: ${DOCS.cursor_mcp} · ${DOCS.cursor_help}`,
    ],
  },
  claude: {
    host: "claude",
    display_name: "Claude Desktop",
    steps_en: [
      "Quit Claude Desktop fully (not just close the window).",
      "Reopen Claude Desktop so mcpServers from claude_desktop_config.json reload.",
      "Confirm compass-mcp appears under MCP / connectors and tools list includes new names.",
    ],
    steps_ko: [
      "Claude Desktop을 완전히 종료 (창만 닫지 말고 앱 종료).",
      "다시 열어 claude_desktop_config.json 의 mcpServers 를 다시 로드.",
      "MCP/커넥터에 compass-mcp 와 새 도구 이름이 보이는지 확인.",
    ],
    notes_en: [
      "Claude Desktop has no in-app MCP refresh button in most builds — restart is the reliable path.",
    ],
    notes_ko: [
      "대부분 빌드에 MCP 새로고침 버튼이 없음 — 재시작이 가장 확실함.",
    ],
  },
  openai: {
    host: "openai",
    display_name: "OpenAI / ChatGPT (MCP-capable clients)",
    steps_en: [
      "Reload or restart the MCP-capable client after editing MCP config.",
      "Re-open the conversation / connector so the tool list refreshes.",
      "If tools stay stale, remove and re-add the compass-mcp connector, then restart.",
    ],
    steps_ko: [
      "MCP 설정 변경 후 MCP를 지원하는 클라이언트를 다시 로드하거나 재시작.",
      "대화/커넥터를 다시 열어 도구 목록을 갱신.",
      "그래도 옛 목록이면 compass-mcp 커넥터 제거→재추가 후 재시작.",
    ],
    notes_en: [
      "UI labels vary by product — treat this as best-effort.",
    ],
    notes_ko: [
      "제품마다 UI 라벨이 다름 — best-effort 안내.",
    ],
  },
  vscode: {
    host: "vscode",
    display_name: "VS Code (MCP extensions)",
    steps_en: [
      "Open MCP / Copilot Chat MCP settings for your extension.",
      "Disable then enable the compass-mcp server, or use Reload Window (Developer: Reload Window).",
      "If still stale: quit VS Code and reopen; check the extension’s MCP output channel.",
    ],
    steps_ko: [
      "사용 중인 확장의 MCP / Copilot Chat MCP 설정 열기.",
      "compass-mcp 서버 비활성→활성, 또는 Developer: Reload Window.",
      "그래도 안 되면 VS Code 종료 후 재실행; 확장 MCP 출력 채널 확인.",
    ],
    notes_en: [
      "Exact menus depend on the MCP extension — Reload Window is the common fallback.",
    ],
    notes_ko: [
      "메뉴는 MCP 확장마다 다름 — Reload Window 가 흔한 대안.",
    ],
  },
  generic: {
    host: "generic",
    display_name: "Generic MCP host",
    steps_en: [
      "Restart the MCP host process after install/update.",
      "If the host has a per-server toggle or refresh, use that for compass-mcp.",
      "Last resort: remove the server entry, save config, re-add, then restart.",
    ],
    steps_ko: [
      "설치/업데이트 후 MCP 호스트 프로세스를 재시작.",
      "서버별 토글/새로고침이 있으면 compass-mcp 에 적용.",
      "최후: 서버 항목 제거 → 설정 저장 → 재추가 → 재시작.",
    ],
    notes_en: [
      "Best-effort — prefer your host’s docs when available.",
    ],
    notes_ko: [
      "best-effort — 가능하면 호스트 공식 문서 우선.",
    ],
  },
};

export function normalizeRefreshHost(
  host?: string | null,
): RefreshHost {
  const h = (host ?? "cursor").trim().toLowerCase();
  if (h === "claude-desktop" || h === "anthropic") return "claude";
  if (h === "chatgpt" || h === "gpt") return "openai";
  if (h === "vs-code" || h === "code") return "vscode";
  if (h === "forge" || h === "openclaw" || h === "other") return "generic";
  if ((REFRESH_HOSTS as string[]).includes(h)) return h as RefreshHost;
  return "cursor";
}

export function buildHowToRefreshMcp(input?: {
  host?: string | null;
  locale?: RefreshLocale | null;
}) {
  const host = normalizeRefreshHost(input?.host);
  const locale: RefreshLocale = input?.locale === "en" ? "en" : "ko";
  const guide = GUIDES[host];
  const steps = locale === "en" ? guide.steps_en : guide.steps_ko;
  const notes = locale === "en" ? guide.notes_en : guide.notes_ko;

  return {
    tool: "how_to_refresh_mcp" as const,
    host: guide.host,
    display_name: guide.display_name,
    locale,
    steps,
    steps_en: guide.steps_en,
    steps_ko: guide.steps_ko,
    notes,
    notes_en: guide.notes_en,
    notes_ko: guide.notes_ko,
    docs: host === "cursor" ? DOCS : undefined,
    expected_tools: [...EXPECTED_TOOL_NAMES],
    tip_en:
      "After install/update, if tools look stale (e.g. start_session missing), follow these steps then ask the agent to call how_to_refresh_mcp again if needed.",
    tip_ko:
      "설치/업데이트 후 도구가 안 보이면(예: start_session 없음) 위 절차 후, 필요하면 에이전트에게 how_to_refresh_mcp 를 다시 호출하게 하세요.",
  };
}

/** Short bilingual hint for start_session / setup when the host tool list may be stale. */
export function mcpRefreshSessionHint() {
  return {
    tool: "how_to_refresh_mcp",
    en: "If MCP tools look stale after install/update (e.g. start_session missing), call how_to_refresh_mcp (host: cursor|claude|openai|vscode|generic).",
    ko: "설치/업데이트 후 MCP 도구가 옛 목록이면(예: start_session 없음) how_to_refresh_mcp 호출 (host: cursor|claude|openai|vscode|generic).",
  };
}
