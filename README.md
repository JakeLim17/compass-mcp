# Compass MCP (`compass-mcp`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-informational.svg)](https://modelcontextprotocol.io)

## Purpose

**Pick the model that fits the task — not always the cheapest, not locked to one vendor.**

Read the task sentence (intent · scope · difficulty) — not keyword spam.

| Task | Primary (typical) |
|------|-------------------|
| Light patch / i18n | Composer |
| UI / multi-file | Sonnet or Fable |
| Design / planning / tradeoffs | **Fable · Grok · Opus · Sonnet** (compete by scope) |
| Hard bug / CI | Codex (Terra) |

**Philosophy:** best fit for the job → if that model is missing or unavailable on your host, **use the next id in `candidates` / `fallback_chain`**.

Saving means **avoiding overspend** (Codex on a one-liner), not under-spending on design.

Local MCP recommends a catalog model. It does **not** auto-switch the chat UI dropdown.

**SSOT for scoring:** this MCP. Cursor rules only call tools — they must **not** paste full MCP dumps into chat (2-line summary).

---

## Install

```bash
git clone https://github.com/JakeLim17/compass-mcp.git
cd compass-mcp
npm run setup
```

Paste into `~/.cursor/mcp.json`, then refresh MCP (`how_to_refresh_mcp`).

> Not on npm — clone from GitHub only.

**Update later:** `npm run sync` (pull + build + smoke + refresh reminder).

---

## Agents: recommend → execute (critical)

1. Call `recommend_model` or `start_session` with `task_description`
2. Read **`run_hint.ko`**: `다음 Task model=<primary_id> …`
3. Launch Task/subagent with **`model: primary_id`**
4. If host says unavailable → `candidates[1].id`, then next in `fallback_chain`
5. `log_model_usage` → `set_sticky`
6. Tell the user via **`model_persistence`** — never say “sticky”

The agent **calling** this MCP (e.g. Composer) may differ from the **task** recommendation (`primary_id`). That is intentional.

---

## Cursor catalog only

We only recommend models Cursor can run. If missing/blocked → **next in `candidates`**.

| Family | Ladder (cheap → heavy) | Slugs |
|--------|------------------------|-------|
| Cursor-cheap | Composer | `composer-2.5-fast` |
| Claude | Sonnet < Opus < Fable | `claude-sonnet-5-thinking-high` → … → `claude-fable-5-thinking-high` |
| GPT | Sol < Terra/Codex | `gpt-5.6-sol-medium` → `gpt-5.6-terra-medium` |
| Design contenders | Grok · Fable · Opus · Sonnet | scope picks primary |
| Optional | Kimi | `kimi-k2.7-code` (resolve/sticky only) |

### How to add a model

1. Add slug to `CURSOR_AGENT_CATALOG` and `CURSOR_TASK_SLUG` in `src/recommend.ts`
2. Add `ModelId`, `BASE`, `COST_TIER`, `MODEL_TIER`, keyword/tag boosts as needed
3. Mirror slug in `CURSOR_IDS` in `src/hosts.ts` (cursor profile)
4. Add smoke case + example prompt if user-facing
5. Bump version, `npm test`, refresh MCP

---

## Fallback chain (`candidates`)

`recommend_model` returns compact JSON including:

```json
{
  "primary_id": "claude-fable-5-thinking-high",
  "candidates": [ … ],
  "fallback_chain": ["claude-fable-5-thinking-high", "cursor-grok-4.5-high-fast", "…"],
  "run_hint": {
    "ko": "다음 Task model=claude-fable-5-thinking-high (불가 시 …) → log_model_usage → set_sticky"
  },
  "agent_note": { "ko": "실제 작업(Task/subagent)은 primary_id로 실행…" }
}
```

---

## Tools (complete)

| Tool | What |
|------|------|
| `start_session` | Compact work start: version, adopted model, alerts, optional recommend + **`run_hint`** |
| `session_check` | Alias of `start_session` |
| `check_update` | Local version + optional git behind hint; links to `npm run sync` + refresh |
| `how_to_refresh_mcp` | Host-specific MCP refresh steps (Cursor: Tools & MCP toggle) |
| `recommend_model` | Task-fit primary + `candidates` + `run_hint` + `agent_note` |
| `get_sticky` / `set_sticky` / `clear_sticky` | Adopted model persistence (internal names; user: “같은 작업이면 모델 유지”) |
| `get_project_config` | Load `.compass-mcp.json` — **cost_bias**, **blocked/unavailable** feed into scoring |
| `get_usage_summary` | Counts + alerts + `report.ko`/`report.en` (verbose or locale) |
| `log_model_usage` | Append usage JSONL (no secrets) |
| `feedback_recommendation` | good/bad → light score nudge on next recommend |
| `list_example_prompts` | Example KO prompts + expected primaries |
| `list_hosts` | Host profiles + Cursor ladder + unavailable_roles |

Pass `verbose: true` only when debugging.

---

## Project config (`.compass-mcp.json`)

Walk up from `cwd` for `.compass-mcp.json`. Copy from [`.compass-mcp.json.example`](./.compass-mcp.json.example).

| Field | Effect on `recommend_model` |
|-------|----------------------------|
| `cost_bias: cheap` (default when unset) | Boost Composer/Sonnet; penalize overspend |
| `cost_bias: quality` | Allow Fable/Grok/Codex more often |
| `blocked_models` / `unavailable_models` | −200 score; skipped in `candidates` |
| `default_tier: low\|mid\|high` | Soft nudge when scores are flat |
| `preferred_host` | Host-mapped `primary_id` (cursor/claude/openai/generic) |
| `usage_alert_thresholds` | `high_tier_today` / `heavy_today` → `prefer_cheaper` when alerts fire |

Verify: `get_project_config` then recommend with `cwd` set to project root.

---

## Behavior cheatsheet

| Command signal | Primary |
|----------------|---------|
| One-line / i18n / tiny | Composer |
| Normal UI | **Sonnet** (not Fable) |
| Large UI redesign | Fable |
| Hard bug / CI | Terra; fallback Sol → Sonnet |
| Design / planning / tradeoffs | **Fable / Grok / Opus / Sonnet** |
| Design → implement | **switch** → Composer (UI impl → Fable) |
| “싸게 / 토큰 아껴” | avoid overspend |
| “최고 품질 / 비싸도 됨” / `cost_bias: quality` | premium OK |

---

## Scripts

```bash
npm run setup      # install + mcp.json snippet + version
npm run sync       # git pull + build + smoke + refresh reminder
npm start
npm test           # smoke (42+ checks)
npm run typecheck
npm run build
```

---

## Practical 10/10 checklist

Use this to verify a fresh install:

- [ ] `npm run setup` prints version
- [ ] MCP tools include `start_session`, `check_update`, `recommend_model`, `get_project_config`
- [ ] `recommend_model` returns `run_hint.ko` with `primary_id`
- [ ] `candidates.length >= 2` and catalog slugs only
- [ ] Agent runs Task with `model: primary_id` (not just Composer caller)
- [ ] `log_model_usage` + `set_sticky` after adoption
- [ ] User never sees the word “sticky” — `model_persistence` instead
- [ ] `.compass-mcp.json` affects blocked/cost_bias (smoke: blocked Codex → Sol)
- [ ] `get_usage_summary` alerts when high-tier overused
- [ ] `feedback_recommendation` nudges next recommend
- [ ] Stale tools → `check_update` / `how_to_refresh_mcp` / `npm run sync`
- [ ] `npm test` all green

**Self-score target:** usefulness 9–10 / completeness 9–10 for agents following the rules above.

---

## Limits

- **Chat UI dropdown does not auto-switch** — intentional ceiling; agents must pass `primary_id` to Task/subagent
- **`primary` / `for_task` ≠ the model running the MCP call**
- Cost/token_risk are relative, not dollars
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)

---

## License

[MIT](./LICENSE)

---

**한국어:** 명령을 정독해 **작업에 맞는 모델**을 고르는 로컬 MCP. 추천 후 **`run_hint.ko`대로 Task `model=primary_id`**. 없으면 `candidates` 다음 id. compact 응답. 에이전트는 MCP 덤프·「sticky」단어 금지.
