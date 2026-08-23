# Compass MCP

Local MCP that reads what you're doing and suggests which model fits — copy tweak vs UI vs nasty bug, that kind of thing.

## How it runs

Each real task should pass through **`start_session`** (compact) once: cheap model by default, heavier only when the task needs it. Agents follow workspace rules to call it at work start (including Multitask / subagents — do not skip). **Cursor does not auto-switch the chat dropdown** or intercept every message. Same task + `stick_action=keep` → no repeat recommend. If the user says a prompt-only test phrase, still call `start_session` or `recommend_model`; do not implement.

## Install

```bash
git clone https://github.com/JakeLim17/compass-mcp.git
cd compass-mcp
npm run connect -- cursor
npm run connect -- claude
npm run connect -- codex
```

Pick one host line. It installs, builds, and writes your MCP config (existing config gets backed up first).

Then restart the app. On Cursor: sidebar **Customize → MCPs** → toggle off and on.

Not on npm — clone from GitHub. Updates: `npm run sync`.

**Catalog maintenance:** Cursor adds models often. Recheck Task slugs in `src/recommend.ts` / `src/hosts.ts` against [Models & Pricing](https://cursor.com/docs/models-and-pricing) about monthly (or when the Cursor Models picker changes). Then `npm run sync` and toggle MCP in Customize → MCPs.

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

**한국어:** 작업 문장 보고 모델 추천하는 로컬 MCP (v0.9.1+). `npm run connect -- cursor|claude|codex` 한 줄 설치. 채팅에 그냥 "이 작업 모델 뭐 쓸까", "페이블로 문구 수정", "타입 에러 회귀 디버그"처럼 말하면 됨. 말로 모델 지정(`페이블로`, `코덱스로`)하면 점수보다 우선. **실작업·Multitask·서브에이전트는 `start_session`(compact) 항상** — 「부모 완료」「테스트 창」 핑계로 생략 금지. 「테스트야」는 MCP 호출·코드 수정만 금지. **설계(Fable/Grok/Opus) 끝나고 「구현 들어가」면 Sonnet으로 내려감** — 전면 리디자인·「페이블로」는 Fable 유지. 채팅 드롭다운은 자동 안 바뀜 — Cursor가 메인, 웹 HTTP는 필요할 때만.
