# Compass MCP (`compass-mcp`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-informational.svg)](https://modelcontextprotocol.io)

## Purpose

Vibe-coding without guessing which model fits **UI vs bugs vs architecture**.  
Local MCP recommends a model (plus cost / token-risk hints). It does **not** auto-switch the chat UI dropdown.

**SSOT for scoring:** this MCP. Cursor rules only call tools in order — they do not re-encode the scoring tables.

---

## Install

```bash
git clone https://github.com/JakeLim17/compass-mcp.git
cd compass-mcp
npm run setup    # npm i + prints Cursor / Claude mcp.json snippets
```

Paste the printed snippet into `~/.cursor/mcp.json` (or Claude Desktop config), then **refresh MCP** (see below) / restart the host.

> Not on npm — clone from GitHub only.

### After update: refresh MCP

New tools (e.g. `start_session`, `how_to_refresh_mcp`) only appear after the host reloads the server.

**Ask the agent:** `how_to_refresh_mcp` with optional `host` (`cursor` | `claude` | `openai` | `vscode` | `generic`) and `locale` (`ko` | `en`, default `ko`).

**Cursor (official docs):** [MCP](https://cursor.com/docs/mcp.md) · [Help: MCP](https://cursor.com/help/customization/mcp.md)

1. Settings: Mac `Cmd+Shift+J` (Win/Linux `Ctrl+Shift+J`) → **Tools & MCP**
2. Find `compass-mcp` / `user-compass-mcp` → toggle **OFF** then **ON** (or ↻ if shown)
3. Optional: `Cmd+Shift+P` → search MCP / Tools & MCP (docs have **no** dedicated “MCP: Refresh” command)
4. Still stale: quit Cursor fully and reopen; then remove + re-add; MCP Logs via `Cmd+Shift+U`

### Cursor snippet shape

```json
{
  "mcpServers": {
    "compass-mcp": {
      "command": "npx",
      "args": ["tsx", "/ABS/PATH/TO/compass-mcp/src/server.ts"]
    }
  }
}
```

---

## Tools

| Tool | What |
|------|------|
| **`start_session`** (`session_check`) | **One call:** sticky + usage alerts + `report` + optional quick recommend; includes `mcp_refresh` hint |
| **`how_to_refresh_mcp`** | Host steps to reload MCP after install/update (`host`, `locale`) |
| `recommend_model` | Primary + alt + tiers + `token_risk` + sticky/project/feedback |
| `get_sticky` / `set_sticky` / `clear_sticky` | Adopted model file |
| `get_usage_summary` | `period: day\|week` + model/tier counts + **`report`** (en/ko) + `alerts[]` |
| `get_project_config` | Load `.compass-mcp.json` |
| `log_model_usage` | Append usage JSONL (no secrets) |
| `feedback_recommendation` | good/bad → light score nudge |
| `list_example_prompts` / `list_hosts` | Examples + host id maps |

### Recommended call order

**Work start:** `start_session` (optional `task_description`) → pick → `log_model_usage` → `set_sticky`  

Or: `get_sticky` → `recommend_model` → …  

Test-only prompts → recommend / `start_session` only, **no code edits**.

---

## Weekly / daily report

`get_usage_summary({ period: "week" })` (default) or `"day"`:

- `by_model` / `by_tier` for that window  
- `report.en` + `report.ko` (friendly digest)  
- `report_text` when `locale` is set  
- `alerts[]` from **today’s** high-tier / heavy usage  

Surface alerts **once per session**.

---

## Project template (drop into repo root)

```bash
cp /path/to/compass-mcp/.compass-mcp.json.example ./.compass-mcp.json
```

Soft prefs only (scoring SSOT stays in MCP):

```json
{
  "preferred_host": "cursor",
  "default_tier": "low",
  "blocked_models": [],
  "cost_bias": "prefer_cheaper",
  "usage_alert_thresholds": {
    "high_tier_today": 3,
    "heavy_today": 8
  }
}
```

---

## Sticky

File: `~/.cursor/compass-mcp/sticky.json` — `recommend_model` / `start_session` load it when `current_model` is omitted → `stick_action` `keep` | `switch`.

---

## Token risk & Claude cheaper ladder

Approx relative cost: **Composer < Sonnet < Opus < Fable/Codex** (Grok = design-mid, off the Claude ladder).

| Trigger | Behavior |
|---------|----------|
| `token_risk=low` | Quality-first (usually Composer) |
| `token_risk=medium` | Normal scoring |
| `prefer_cheaper` + bulk | Composer primary |
| `prefer_cheaper` + UI | **Claude Sonnet** primary (quality-cheap vs Fable) |
| `prefer_cheaper` + hard bug | Codex primary; `cheaper_fallback` = **Sonnet** (explore first) |
| `cost_bias: prefer_cheaper\|cheap` / usage alerts | Sets `prefer_cheaper` |

Every `recommend_model` response includes:

- `cheaper_fallback`: `{ name, slug, tier }`
- `cheaper_fallback_slug` — use as Cursor Task `model` when saving tokens

**Honest limit:** Cursor chat UI dropdown does **not** auto-switch. Agents set Task `model` to `primary_slug` or `cheaper_fallback_slug` (Sonnet/Composer).

Tiers: `low`=Composer · `mid`=Sonnet/Opus/Fable/Grok · `high`=Codex.

---

## Scripts

```bash
npm run setup       # install + print mcp snippets
npm start           # stdio via tsx
npm test            # smoke
npm run typecheck
npm run build
```

## Limits

- Chat UI dropdown does not auto-switch  
- Cursor **does** support Claude Sonnet/Opus via Task `model` slug (`cheaper_fallback_slug`)  
- Claude/OpenAI host ids are approximate (`src/hosts.ts`)  
- Cost/token_risk are relative, not dollars / live quota  

## License

[MIT](./LICENSE)

---

**한국어:** 바이브코딩용 로컬 모델 추천 MCP. Claude 폴백 사다리 `Composer < Sonnet < Opus < Fable/Codex`. `prefer_cheaper`면 Task `model`에 `cheaper_fallback_slug`(또는 Sonnet). UI 드롭다운 자동전환은 불가. `git clone` → `npm run setup` → mcp.json → **MCP 새로고침**(`how_to_refresh_mcp`).
