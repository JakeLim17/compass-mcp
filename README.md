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

**Philosophy:** best fit for the job → if that model is missing or unavailable on your host, **use the next id in `candidates` / `fallback_chain`**. Same routing on Cursor, VS Code, Claude Desktop, OpenAI/Codex, or generic MCP hosts (host-mapped ids).

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

---

## Cursor catalog only

We only recommend models Cursor can run. If missing/blocked → **next in `candidates`** (`fallback_chain` slug list). Never invent slugs.

| Family | Ladder (cheap → heavy) | Slugs |
|--------|------------------------|-------|
| Cursor-cheap | Composer | `composer-2.5-fast` |
| Claude | Sonnet < Opus < Fable | `claude-sonnet-5-thinking-high` → `claude-opus-4-8-thinking-high` → `claude-fable-5-thinking-high` |
| GPT | Sol < Terra/Codex | `gpt-5.6-sol-medium` → `gpt-5.6-terra-medium` |
| Design contenders | Grok · Fable · Opus · Sonnet | scope picks primary — not Claude-only |
| Optional | Kimi | `kimi-k2.7-code` (resolve/adopted-model only) |

---

## Fallback chain (`candidates`)

`recommend_model` returns:

```json
{
  "primary": "Fable 5",
  "primary_id": "claude-fable-5-thinking-high",
  "alternative": "Grok 5.x",
  "candidates": [
    { "name": "Fable 5", "id": "claude-fable-5-thinking-high", "slug": "claude-fable-5-thinking-high", "reason": "task-fit primary" },
    { "name": "Grok 5.x", "id": "cursor-grok-4.5-high-fast", "slug": "cursor-grok-4.5-high-fast", "reason": "second-best score" },
    { "name": "Claude Opus", "id": "claude-opus-4-8-thinking-high", "slug": "claude-opus-4-8-thinking-high", "reason": "step-down if unavailable" }
  ],
  "fallback_chain": ["claude-fable-5-thinking-high", "cursor-grok-4.5-high-fast", "claude-opus-4-8-thinking-high"]
}
```

**Agents:** Task `model=primary_id`. If the host says unavailable → `candidates[1].id`, then next. Works the same on **Cursor, VS Code (`host=vscode` → generic), Claude, OpenAI**.

`list_hosts` shows `unavailable_roles` per host so you know what will be skipped.

---

## Tools (compact by default)

| Tool | What |
|------|------|
| `start_session` | adopted model + alert codes + optional recommend (**no weekly essay** unless `include_report` / `verbose`) |
| `recommend_model` | Short JSON: primary, `candidates`, `fallback_chain`, `cost_preview`, `model_persistence`, one-line `reason` |
| `get_usage_summary` | Counts + alerts; full report when `verbose` or `locale` |
| `get_sticky` / `set_sticky` / … | Adopted model (internal API names; user-facing: “같은 작업이면 모델 유지”) |
| `list_hosts` / `list_example_prompts` | Compact maps + fallback notes |

Pass `verbose: true` only when debugging.

**Reading the recommendation:** `primary` / `for_task` = the model that fits **your task**. The agent or Task worker that **called** this MCP (e.g. Composer) may be different — see `clarity.ko` / `cost_preview.advice.ko`. **`stick_action`** is API-only; tell the user via **`model_persistence`** (“같은 작업이면 모델 유지” / “작업 종류가 바뀌어 ○○로 바꾸길 권함”).

**Agents:** `stick_action=keep` → do not re-call every trivial message. Design model + implementation task → `switch` to Composer (UI impl → Fable). If `primary_id` unavailable → next in `candidates`. **Do not say “sticky” to the user.**

---

## Behavior cheatsheet

| Command signal | Primary |
|----------------|---------|
| One-line / i18n / tiny | Composer |
| Normal UI | **Sonnet** (not Fable) |
| Large UI redesign | Fable |
| Hard bug / CI | Terra; fallback Sol → Sonnet |
| Design / planning / tradeoffs | **Fable / Grok / Opus / Sonnet** (by scope — not fixed) |
| Light plan (“간단 계획”) | Sonnet or Composer |
| Design → implement (“설계 구현해보자”) | **switch** → Composer (UI impl → Fable) |
| “싸게 / 토큰 아껴” | avoid overspend on light work |
| “최고 품질 / 비싸도 됨” / `cost_bias: quality` | premium OK |

Default `cost_bias` when unset = **cheap** (avoid overspend, not under-spend on design).

---

## Example prompts

Paste into chat (or call `list_example_prompts`). Design examples: **primary varies** — see `expected_primaries` in verbose mode.

| KO example | Save default (cheap) | Quality expect |
|------------|----------------------|----------------|
| 로그인 문구 i18n 한 줄만 수정해줘 | Composer | Composer |
| 대시보드 레이아웃 리팩터… | **Sonnet** | Fable (large redesign) |
| 결제 모듈 구조 설계… 트레이드오프 | **Fable / Grok / Opus** | same family |
| CI 실패 재현… 타입 에러 | Codex (Terra) | Codex (Terra) |

Source of truth: `src/examples.ts` → `list_example_prompts`.

---

## Project template

```bash
cp /path/to/compass-mcp/.compass-mcp.json.example ./.compass-mcp.json
```

```json
{
  "preferred_host": "cursor",
  "default_tier": "low",
  "blocked_models": [],
  "unavailable_models": [],
  "cost_bias": "cheap",
  "usage_alert_thresholds": { "high_tier_today": 3, "heavy_today": 8 }
}
```

Hosts: `cursor` | `claude` | `openai` | `vscode` | `generic` (VS Code MCP → `vscode` or `generic`).

---

## Scripts

```bash
npm run setup
npm start
npm test          # smoke
npm run typecheck
npm run build
```

## Limits

- Chat UI dropdown does not auto-switch  
- **`primary` / `for_task` ≠ the model running the MCP call**  
- Cost/token_risk are relative, not dollars  
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)

## License

[MIT](./LICENSE)

---

**한국어:** 명령을 정독해 **작업에 맞는 모델**을 고르는 로컬 MCP. 설계·기획은 Fable/Grok/Opus/Sonnet이 경쟁(Claude 고정 아님). 없으면 `candidates` 다음 id. Cursor·VS Code·Claude·OpenAI 동일 철학. compact 응답. 에이전트는 MCP 덤프·「sticky」단어 금지.
