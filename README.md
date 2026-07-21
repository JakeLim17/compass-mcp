# Compass MCP (`compass-mcp`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-informational.svg)](https://modelcontextprotocol.io)

## Purpose

**Pick the model that fits the task — not always the cheapest.**

Read the task sentence (intent · scope · difficulty) — not keyword spam.

| Task | Primary |
|------|---------|
| Light patch / i18n | Composer |
| UI / multi-file | Sonnet or Fable |
| Design / planning / tradeoffs | **Claude (Fable)** |
| Hard bug / CI | Codex (Terra) |

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

We only recommend models Cursor can run. If missing/blocked → **next on the ladder** (`fallback_chain`). Never invent slugs.

| Family | Ladder (cheap → heavy) | Slugs |
|--------|------------------------|-------|
| Cursor-cheap | Composer | `composer-2.5-fast` |
| Claude | Sonnet < Opus < Fable | `claude-sonnet-5-thinking-high` → `claude-opus-4-8-thinking-high` → `claude-fable-5-thinking-high` |
| GPT | Sol < Terra/Codex | `gpt-5.6-sol-medium` → `gpt-5.6-terra-medium` |
| Optional alt | Grok | `cursor-grok-4.5-high-fast` (not design primary) |
| Optional | Kimi | `kimi-k2.7-code` (resolve/adopted-model only) |

---

## Tools (compact by default)

| Tool | What |
|------|------|
| `start_session` | adopted model + alert codes + optional recommend (**no weekly essay** unless `include_report` / `verbose`) |
| `recommend_model` | Short JSON: primary, slugs, `cost_preview` (weight/relative/advice), `model_persistence`, `cheaper_fallback_slug`, `fallback_chain`, one-line `reason` |
| `get_usage_summary` | Counts + alerts; full report when `verbose` or `locale` |
| `get_sticky` / `set_sticky` / … | Adopted model (internal API names; user-facing: “같은 작업이면 모델 유지”) |
| `list_hosts` / `list_example_prompts` | Compact maps |

Pass `verbose: true` only when debugging.

**Reading the recommendation:** `primary` / `for_task` = the model that fits **your task**. The agent or Task worker that **called** this MCP (e.g. Composer) may be different — see `clarity.ko` / `cost_preview.advice.ko`. **`stick_action`** is API-only; tell the user via **`model_persistence`** (“같은 작업이면 모델 유지” / “작업 종류가 바뀌어 ○○로 바꾸길 권함”).

**Cost hints (`cost_preview`):** relative weight only (light / medium / heavy, Composer ≈1× ladder) — **not** billing, token counts, or Cursor balance. Wording is task-fit (“이 작업엔 ○○가 맞음 — △△는 과함”), not “always go cheap”.

**Agents:** `stick_action=keep` → do not re-call every trivial message. Design model + implementation task → `switch` to Composer (UI impl → Fable). Prefer Task `model` = `cheaper_fallback_slug` when `prefer_cheaper`; if unavailable → next in `fallback_chain`. **Do not say “sticky” to the user.**

---

## Behavior cheatsheet

| Command signal | Primary |
|----------------|---------|
| One-line / i18n / tiny | Composer |
| Normal UI | **Sonnet** (not Fable) |
| Large UI redesign | Fable |
| Hard bug / CI | Terra (`gpt-5.6-terra-medium`); fallback Sol → Sonnet |
| Design / planning / tradeoffs | **Fable (Claude)** — not Grok |
| Design → implement (“설계 구현해보자”) | **switch** → Composer (UI impl → Fable) |
| “싸게 / 토큰 아껴” | avoid overspend on light work |
| “최고 품질 / 비싸도 됨” / `cost_bias: quality` | premium OK |

Default `cost_bias` when unset = **cheap** (avoid overspend, not under-spend on design).

---

## Example prompts

Paste into chat (or call `list_example_prompts`). Defaults below assume **save / cheap** (`cost_bias` unset or `cheap` / `prefer_cheaper`).

| KO example | Save default (cheap) | Quality expect (`cost_bias: quality` / “최고 품질”) |
|------------|----------------------|-----------------------------------------------------|
| 로그인 문구 i18n 한 줄만 수정해줘 | Composer | Composer |
| 대시보드 레이아웃 리팩터하고 히어로 섹션 CSS 정리해줘 | **Sonnet** (not Fable) | Fable (large redesign / premium) |
| 결제 모듈 구조 설계랑 기술 선택 트레이드오프 정리해줘 | **Fable (Claude)** | Fable |
| CI 실패 재현해서 난해한 타입 에러 원인 찾아줘 | Codex (Terra) | Codex (Terra) |

**Honest note:** Under save bias, normal UI maps to Sonnet; Fable is for large redesign, design/planning, or when the user asks for premium quality.

Source of truth for paste strings: `src/examples.ts` → `list_example_prompts`.

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
- **`primary` / `for_task` ≠ the model running the MCP call** — e.g. Composer may call `recommend_model` and get Fable as the task pick  
- Cost/token_risk are relative, not dollars  
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)

## License

[MIT](./LICENSE)

---

**한국어:** 명령을 정독해 **작업에 맞는 모델**을 고르는 로컬 MCP. 가벼운 패치→Composer, 설계·기획→Claude(Fable), 난해 버그→Codex. 과한 모델만 피함. Cursor 카탈로그만 추천·없으면 사다리 다음. 응답은 compact. 에이전트는 MCP 덤프·「sticky」단어를 채팅에 붙이지 말 것.
