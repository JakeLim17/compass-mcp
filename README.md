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
| Copy, i18n, hyphen/dash punctuation, one-line fix | Composer **Standard** (`composer-2.5` UI; Task `composer-2.5-fast`) |
| Small code patch | Same light tier — **Standard over Fast** |
| General UI | Sonnet (`claude-sonnet-5-thinking-high`) |
| Multi-file UI / layout refactor | Fable (`claude-fable-5-thinking-high`) |
| Design, planning, tradeoffs | Grok 4.6 · Fable · Opus · Sonnet |
| Hard bug, CI, type errors | Sol → Terra/Codex (`gpt-5.6-sol-medium` → `gpt-5.6-terra-medium`) |
| Long codebase / code context | Kimi K2.7 (`kimi-k2.7-code`) |
| Extreme / huge scope (rare) | Opus 5 (`claude-opus-5-thinking-high`) |

### Cursor catalog (Task slugs)

| Slug | Role | Cost tier |
|------|------|-----------|
| `composer-2.5` | Chat UI Standard (light work) | low |
| `composer-2.5-fast` | Task fallback for Composer | low |
| `claude-sonnet-5-thinking-high` | General UI / mid Claude | medium |
| `claude-opus-4-8-thinking-high` | Opus 4.8 (legacy) | medium-high |
| `claude-opus-5-thinking-high` | Extreme difficulty (rare) | medium-high |
| `claude-fable-5-thinking-high` | Multi-file UI | medium-high |
| `cursor-grok-4.6-high-fast` | Design / planning (default Grok) | medium-high |
| `cursor-grok-4.5-high-fast` | Grok 4.5 legacy | medium-high |
| `gpt-5.6-sol-medium` | Lighter bug/CI probe | medium-high |
| `gpt-5.6-terra-medium` | Hard bug / Terra | high |
| `kimi-k2.7-code` | Long code context | medium |

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

**한국어:** 작업 문장 보고 모델 추천하는 로컬 MCP (v0.9.8+). `npm run connect -- cursor|claude|codex` 한 줄 설치. **간단 문자·카피·하이픈/구두점·i18n은 Composer 2.5 Standard(Fast 아님, Grok/Claude 금지)** — Task slug는 `composer-2.5-fast` fallback. Cursor 대표 모델 전체( Sonnet/Opus 4.8·5/Fable/Grok/Sol/Terra/Kimi ) 카탈로그 정렬. `copy_task_model`을 Task `model=`에 복사해야 함(말만 switch=위반).
