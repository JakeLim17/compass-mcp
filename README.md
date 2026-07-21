# Compass MCP (`compass-mcp`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-informational.svg)](https://modelcontextprotocol.io)

## Purpose

**Save tokens by picking the smallest model that fits the command.**

Read the task sentence (intent · scope · difficulty) — not keyword spam.  
Default bias = **cheap**. Escalate to Fable / Terra / Opus only when the command clearly needs it (hard bug, large UI redesign, architecture tradeoffs), or the user says premium (“최고 품질”, “비싸도 됨”).

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
| Design | Grok | `cursor-grok-4.5-high-fast` |
| Optional | Kimi | `kimi-k2.7-code` (resolve/sticky only) |

---

## Tools (compact by default)

| Tool | What |
|------|------|
| `start_session` | sticky + alert codes + optional recommend (**no weekly essay** unless `include_report` / `verbose`) |
| `recommend_model` | Short JSON: primary, slugs, `cheaper_fallback_slug`, `fallback_chain`, one-line `reason` |
| `get_usage_summary` | Counts + alerts; full report when `verbose` or `locale` |
| `get_sticky` / `set_sticky` / … | Adopted model |
| `list_hosts` / `list_example_prompts` | Compact maps |

Pass `verbose: true` only when debugging.

**Agents:** sticky `keep` → do not re-call every trivial message. Prefer Task `model` = `cheaper_fallback_slug` when `prefer_cheaper`; if unavailable → next in `fallback_chain`.

---

## Behavior cheatsheet

| Command signal | Primary |
|----------------|---------|
| One-line / i18n / tiny | Composer |
| Normal UI | **Sonnet** (not Fable) |
| Large UI redesign | Fable |
| Hard bug / CI | Terra (`gpt-5.6-terra-medium`); fallback Sol → Sonnet |
| Architecture tradeoffs | Grok (design only) |
| “싸게 / 토큰 아껴” | stronger save |
| “최고 품질 / 비싸도 됨” / `cost_bias: quality` | premium OK |

Default `cost_bias` when unset = **cheap**.

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
- Cost/token_risk are relative, not dollars  
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)

## License

[MIT](./LICENSE)

---

**한국어:** 명령을 정독해 **최소 적합 모델**만 고르는 로컬 MCP. 기본 절약. Cursor 카탈로그만 추천·없으면 사다리 다음. 응답은 compact. 에이전트는 MCP 덤프를 채팅에 붙이지 말 것.
