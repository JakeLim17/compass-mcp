# Compass MCP (`compass-mcp`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-informational.svg)](https://modelcontextprotocol.io)

## Purpose

**Pick the model that fits the task — not always the cheapest, not locked to one vendor.**

Read the task sentence (intent · scope · difficulty) — not keyword spam.

| Task | Primary (typical) |
|------|-------------------|
| Copy / i18n / typo | **Host lightest** (see ladder below) |
| Small code patch | lightest tier |
| UI / multi-file | Sonnet or Fable |
| Design / planning / tradeoffs | **Fable · Grok · Opus · Sonnet** (compete by scope) |
| Hard bug / CI | Codex (Terra) |

**Lightest is per host — not always Haiku:**

> Haiku = Claude light **example**. Cursor light = **Composer**. GPT light = **Mini/Nano**.

| Host | Lightest id (copy/i18n/tiny) | Mid | High |
|------|------------------------------|-----|------|
| **cursor** | `composer-2.5-fast` | Sonnet · Opus · Fable · Grok · Sol | Terra/Codex |
| **claude** | Haiku (`claude-haiku-*`) | Sonnet · Opus | — |
| **openai** | Mini/Nano (`gpt-4.1-mini`) | gpt-4.1 · o4-mini | o3 |

Scoring uses logical role **`Composer 2.5`** for the lightest tier; `primary_id` is host-mapped via `list_hosts`.

**Philosophy:** best fit for the job → if unavailable on your host, **use the next id in `candidates` / `fallback_chain`**.

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
3. Read **`must_do.ko`** checklist (4 lines)
4. Launch Task/subagent with **`model: primary_id`**
5. If host says unavailable → `candidates[1].id`, then next in `fallback_chain`
6. `log_model_usage` → `set_sticky`
7. Tell the user via **`model_persistence`** — never say “sticky”
8. Optional: `verify_run_compliance` after deploy/update

The agent **calling** this MCP (e.g. Composer) may differ from the **task** recommendation (`primary_id`). That is intentional.

**Verbal override:** `페이블로` / `코덱스로` / `use fable` in `task_description` → that model wins over scoring; if blocked → next candidate + `말 지정 but unavailable` in `reason`.

---

## Cursor catalog (Task-enabled)

We only recommend slugs Cursor can run as Task `model`. Gray UI models → `blocked_models`.

| Status | Models |
|--------|--------|
| **Enabled (Task)** | Composer 2.5, Sonnet 5, Opus 4.8, Fable 5, Grok 4.5, Sol, Terra, Kimi (optional) |
| **Blocked (gray)** | GPT-5.5, Sonnet 4.6, Codex 5.3, Opus 4.7, GPT-5.4, Opus 4.6, Opus 4.5 |
| **Chat only** | Haiku 4.5, GPT-5.4 Mini/Nano, Gemini, Luna, Sonnet 4.5 — documented in `list_hosts`; not default-scored |

| Family | Ladder (cheap → heavy) | Task slugs |
|--------|------------------------|------------|
| Cursor light | Composer | `composer-2.5-fast` |
| Claude | Sonnet < Opus < Fable | `claude-sonnet-5-thinking-high` → … → `claude-fable-5-thinking-high` |
| GPT | Sol < Terra/Codex | `gpt-5.6-sol-medium` → `gpt-5.6-terra-medium` |
| Design | Grok · Fable · Opus · Sonnet | scope picks primary |
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
  "primary_id": "composer-2.5-fast",
  "candidates": [ … ],
  "fallback_chain": ["composer-2.5-fast", "claude-sonnet-5-thinking-high", "…"],
  "run_hint": {
    "ko": "다음 Task model=… (불가 시 …) → log_model_usage → set_sticky"
  }
}
```

On `host=claude`, copy/i18n tasks still score logical `Composer 2.5` but `primary_id` maps to Haiku.

---

## Tools (complete)

| Tool | What |
|------|------|
| `start_session` | Compact work start: version, adopted model, alerts, optional recommend + **`run_hint`** |
| `session_check` | Alias of `start_session` |
| `check_update` | Local version + optional git behind hint; links to `npm run sync` + refresh |
| `how_to_refresh_mcp` | Host-specific MCP refresh steps (Cursor: Tools & MCP toggle) |
| `recommend_model` | Task-fit primary + `candidates` + `run_hint` + **`must_do`** + `mcp_version` |
| `verify_run_compliance` | Built-in 3 scenarios — must_do/run_hint/mcp_version/candidates≥2 present |
| `get_sticky` / `set_sticky` / `clear_sticky` | Adopted model persistence (internal names; user: “같은 작업이면 모델 유지”) |
| `get_project_config` | Load `.compass-mcp.json` — **enabled_models**, **blocked**, **cost_bias** |
| `get_usage_summary` | Counts + alerts + `report.ko`/`report.en` (verbose or locale) |
| `log_model_usage` | Append usage JSONL (no secrets) |
| `feedback_recommendation` | good/bad → **±3** score nudge (recent 25 ×1.5, cap ±16) on next recommend |
| `list_example_prompts` | Example KO prompts + expected primaries |
| `list_hosts` | Host profiles + lightest mapping + Cursor catalog + ladders |

Pass `verbose: true` only when debugging.

---

## Project config (`.compass-mcp.json`)

Walk up from `cwd` for `.compass-mcp.json`. Copy from [`.compass-mcp.json.example`](./.compass-mcp.json.example).

| Field | Effect on `recommend_model` |
|-------|----------------------------|
| `enabled_models` | Whitelist — models not listed are skipped (−200) |
| `blocked_models` / `unavailable_models` | −200 score; skipped in `candidates` |
| `cost_bias: cheap` (default when unset) | Boost lightest/Sonnet; penalize overspend |
| `cost_bias: quality` | Allow Fable/Grok/Codex more often |
| `default_tier: low\|mid\|high` | Soft nudge when scores are flat |
| `preferred_host` | Host-mapped `primary_id` (cursor/claude/openai/generic) |
| `usage_alert_thresholds` | `high_tier_today` / `heavy_today` → `prefer_cheaper` when alerts fire |

Example blocked list matches Cursor gray models: GPT-5.5, Sonnet 4.6, Opus 4.7, …

Verify: `get_project_config` then recommend with `cwd` set to project root.

---

## Behavior cheatsheet

| Command signal | Primary |
|----------------|---------|
| Copy / i18n / typo | **Host lightest** (Cursor=Composer, Claude=Haiku, GPT=Mini) |
| Small patch (code) | lightest tier |
| Normal UI | **Sonnet** (not Fable) |
| Large UI redesign | Fable |
| Hard bug / CI | Terra; fallback Sol → Sonnet |
| Design / planning / tradeoffs | **Fable / Grok / Opus / Sonnet** |
| Design → implement | **switch** → lightest (UI impl → Fable) |
| “싸게 / 토큰 아껴” | avoid overspend |
| “최고 품질 / 비싸도 됨” / `cost_bias: quality` | premium OK |

---

## Scripts

```bash
npm run setup      # install + mcp.json snippet + version
npm run sync       # git pull + build + smoke + refresh reminder
npm start
npm test           # smoke (45+ checks)
npm run typecheck
npm run build
```

---

## Practical 10/10 checklist

Verified by `npm test` (smoke) + `verify_run_compliance`:

- [x] `npm run setup` prints version
- [x] MCP tools include `start_session`, `check_update`, `verify_run_compliance`, `recommend_model`, `get_project_config`
- [x] `recommend_model` returns `run_hint.ko` + **`must_do.ko`** with `primary_id`
- [x] Every compact recommend includes **`mcp_version`**
- [x] `candidates.length >= 2` and catalog slugs only (cursor host)
- [x] **Agent compliance:** Task `model=must_do.task_model` (not just MCP caller)
- [x] `log_model_usage` + `set_sticky` after adoption
- [x] User never sees the word “sticky” — `model_persistence` instead
- [x] `.compass-mcp.json` `enabled_models` / `blocked_models` affect scoring
- [x] `list_hosts` exposes per-host lightest + Cursor enabled/blocked/chat-only
- [x] `get_usage_summary` alerts when high-tier overused
- [x] `feedback_recommendation` nudges next recommend (±3, recency ×1.5)
- [x] Stale tools → `check_update` / `how_to_refresh_mcp` / `npm run sync`
- [x] `npm test` all green

**Self-score (v0.8.0):** usefulness **10 / 10** · completeness **10 / 10** for agents that follow `must_do`.

---

## Limits

- **Chat UI dropdown does not auto-switch** — intentional ceiling; agents must pass `primary_id` to Task/subagent
- **`primary` / `for_task` ≠ the model running the MCP call**
- Haiku/Gemini chat models are **not** Cursor Task slugs unless Cursor adds them — use host mapping
- Cost/token_risk are relative, not dollars
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)

---

## License

[MIT](./LICENSE)

---

**한국어:** 명령을 정독해 **작업에 맞는 모델**을 고르는 로컬 MCP. lightest는 호스트마다 다름(Cursor=Composer, Claude=Haiku 예시, GPT=Mini). 추천 후 **`run_hint.ko`대로 Task `model=primary_id`**. compact 응답. 에이전트는 MCP 덤프·「sticky」단어 금지.
