# Compass MCP

Local MCP that reads what you're doing and suggests which model fits — copy tweak vs UI vs nasty bug, that kind of thing.

## How it runs

Each real task should pass through **`start_session`** (compact) once: cheap model by default, heavier only when the task needs it. Agents follow workspace rules to call it at work start (including Multitask / subagents — do not skip). **Cursor does not auto-switch the chat dropdown** or intercept every message — copy `copy_task_model` onto Task `model=`. Same task + `stick_action=keep` → no repeat recommend (except when work type switches to planning/architecture). If the user says a prompt-only test phrase, still call `start_session` or `recommend_model`; do not implement.

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
| Copy, i18n, one-line fix | Composer **Standard** (Cursor, Fast 아님) · Haiku (Claude) · Mini (Codex) |
| Small code patch | Same light tier — **Standard over Fast** (Composer $0.5 vs Fast $3 input) |
| UI / multi-file layout | Sonnet |
| Big UI redesign | Fable |
| Design, planning, tradeoffs | Fable · Grok · Opus · Sonnet |
| Hard bug, CI, type errors | Codex |

"Lightest" depends on the host — Cursor's cheap slot is Composer, not Haiku. If the top pick isn't available, it falls back to the next in the list.

## Limits

- Does not change the chat dropdown for you — you or the agent still pick the model.
- **Failure mode:** saying “추천 모델로 다시” without putting `must_do.task_model` (`copy_task_model`) on Task `model=` leaves Composer. Cursor MCP cannot auto-bind Task. `task_model_required` + rules enforce the copy; `verify_run_compliance` cannot see the parent chat runtime.
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

**한국어:** 작업 문장 보고 모델 추천하는 로컬 MCP (v0.9.4+). `npm run connect -- cursor|claude|codex` 한 줄 설치. **간단 작업은 Composer 2.5 Standard(Fast 아님)** — Task slug는 `composer-2.5-fast` fallback, 채팅 UI는 Standard 권장. `copy_task_model`을 Task `model=`에 복사해야 함(말만 switch=위반).
