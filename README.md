# Compass MCP

Local MCP that reads what you're doing and suggests which model fits — copy tweak vs UI vs nasty bug, that kind of thing.

## How it runs

Each real task should pass through **`start_session`** (compact) once: cheap model by default, heavier only when the task needs it. Agents follow workspace rules to call it at work start; **Cursor does not auto-switch the chat dropdown** or intercept every message. Same task + `stick_action=keep` → no repeat recommend. Skip the gate for one-liners, greetings, or prompt-only tests.

## Install

```bash
git clone https://github.com/JakeLim17/compass-mcp.git
cd compass-mcp
npm run connect -- cursor
npm run connect -- claude
npm run connect -- codex
```

Pick one host line. It installs, builds, and writes your MCP config (existing config gets backed up first).

Then restart the app. On Cursor: Cmd/Ctrl+Shift+J → Tools & MCP → toggle off and on.

Not on npm — clone from GitHub. Updates: `npm run sync`.

## Use it

Just say what you're doing in chat. The agent calls Compass and gets a model suggestion.

Examples:

- "What model should I use for this?"
- "Fix the login copy with Fable"
- "Debug this flaky type-error regression"

Say a model name if you want (`페이블로`, `use codex`) — that wins over the score.

## What it usually picks

| You're doing… | Typical pick |
|---------------|--------------|
| Copy, i18n, one-line fix | Composer (Cursor) · Haiku (Claude) · Mini (Codex) |
| Small code patch | Same light tier |
| UI / multi-file layout | Sonnet |
| Big UI redesign | Fable |
| Design, planning, tradeoffs | Fable · Grok · Opus · Sonnet |
| Hard bug, CI, type errors | Codex |

"Lightest" depends on the host — Cursor's cheap slot is Composer, not Haiku. If the top pick isn't available, it falls back to the next in the list.

## Limits

- Does not change the chat dropdown for you — you or the agent still pick the model.
- Cursor is the main target; Claude Code and Codex CLI work too.
- Remote web connectors are optional (see below).

## Remote HTTP (optional)

For Claude.ai / ChatGPT connectors, not day-to-day Cursor:

```bash
export COMPASS_MCP_API_KEY="$(openssl rand -hex 32)"
npm run start:http
# → http://127.0.0.1:3920/mcp
```

Tunnel that port over HTTPS and point the connector at `/mcp` with `Authorization: Bearer <key>`. Local stdio (`npm run connect`) is enough for most people.

## License

MIT

---

**한국어:** 작업 문장 보고 모델 추천하는 로컬 MCP (v0.9.1+). `npm run connect -- cursor|claude|codex` 한 줄 설치. 채팅에 그냥 "이 작업 모델 뭐 쓸까", "페이블로 문구 수정", "타입 에러 회귀 디버그"처럼 말하면 됨. 말로 모델 지정(`페이블로`, `코덱스로`)하면 점수보다 우선. 채팅 드롭다운은 자동 안 바뀜 — Cursor가 메인, 웹 HTTP는 필요할 때만.
