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

### One-command install (no manual clone) — for sharing with teammates

```bash
curl -fsSL https://raw.githubusercontent.com/JakeLim17/compass-mcp/main/scripts/remote-install.sh \
  | bash -s -- cursor   # or: claude / codex
```

Clones (or fast-forward pulls if already cloned) into `~/.compass-mcp`, then runs `npm run connect -- <host>` — same install/update path as above, one line. Override with `COMPASS_MCP_LOCAL_DIR=` / `COMPASS_MCP_REPO_URL=` env vars. Re-running the same command later is the update path (equivalent to `npm run sync` + re-toggling the MCP).

**Catalog maintenance:** Cursor adds models often. Recheck Task slugs in `src/recommend.ts` / `src/hosts.ts` against [Models & Pricing](https://cursor.com/docs/models-and-pricing) about monthly (or when the Cursor Models picker changes). Then `npm run sync` and toggle MCP in Customize → MCPs.

## Update / deploy (for teammates)

Share these commands when someone already has compass-mcp or needs a fresh install.

### Fresh install (one line, no clone)

```bash
curl -fsSL https://raw.githubusercontent.com/JakeLim17/compass-mcp/main/scripts/remote-install.sh \
  | bash -s -- cursor   # or: claude / codex
```

Clones (or fast-forward pulls) into `~/.compass-mcp`, runs `npm install` + `npm run build`, writes MCP config. Then **Customize → MCPs → compass-mcp OFF/ON** (or restart Cursor).

### Already cloned — update to latest

```bash
cd ~/.compass-mcp   # or your clone path, e.g. ~/ChronoCode/compass-mcp
npm run sync
```

`npm run sync` does, in order:

1. `git pull --ff-only origin main` (skip if not a git repo)
2. `npm install`
3. `npm run build`
4. `npm test` (smoke)

After sync finishes, **refresh MCP** so Cursor loads the new build:

- **Cursor:** Customize → MCPs → find `compass-mcp` / `user-compass-mcp` → toggle **OFF then ON**
- Still stale: quit Cursor fully and reopen
- Agent can also call MCP tool `how_to_refresh_mcp` (host: `cursor`)

### Maintainer: ship a release to GitHub

After merging to `main` locally:

```bash
cd compass-mcp
git pull --ff-only origin main
npm run sync          # verify green before push
git push origin main  # teammates / remote-install.sh pick this up
```

Teammates on `remote-install.sh` re-run the same curl one-liner to update; cloned repos use `npm run sync` only.

## Share / propagate to a teammate

Compass MCP (this repo) pairs with [`cursor-engineering-governance`](https://github.com/JakeLim17/cursor-engineering-governance) (security/engineering rules injected into every Agent chat). To bring a new machine or teammate fully up to date, run both:

```bash
# 1) engineering-governance rules (alwaysApply rules + account-map)
curl -fsSL https://raw.githubusercontent.com/JakeLim17/cursor-engineering-governance/main/install.sh \
  | bash -s -- --from-remote

# 2) compass-mcp (model routing MCP)
curl -fsSL https://raw.githubusercontent.com/JakeLim17/compass-mcp/main/scripts/remote-install.sh \
  | bash -s -- cursor

# 3) reconnect the MCP in Cursor
# Customize → MCPs → toggle compass-mcp OFF then ON (or restart Cursor)
```

Already have both cloned locally? Same idea, shorter:

```bash
cd cursor-engineering-governance && git pull --ff-only && ./install.sh --skip-accounts
cd ../compass-mcp && npm run sync
# then: Customize → MCPs → toggle compass-mcp OFF/ON
```

See `cursor-engineering-governance/README.md` §Share for the full governance-side procedure and flags.

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
| General UI (일상) | Composer (`composer-2.5-fast`) — Cursor pool |
| General UI (mid, Composer 부족) | Sonnet (`claude-sonnet-5-thinking-high`) |
| Urgent multi-file UI / layout refactor | Fable (`claude-fable-5-thinking-high`) — **예외만** (토큰 큼) |
| Broad UI redesign | Sonnet (Fable 아님) |
| Design, planning, tradeoffs | **Grok 4.6** (`cursor-grok-4.6-high-fast`) — Cursor pool, don’t under-use |
| Hard bug, CI, type errors | Sol → Terra/Codex (`gpt-5.6-sol-medium` → `gpt-5.6-terra-medium`) |
| Long codebase / code context | Kimi K2.7 (`kimi-k2.7-code`) |
| Extreme / huge scope (rare) | Opus 5 (`claude-opus-5-thinking-high`) |

### Cursor catalog (Task slugs)

**Speed tier** (`speed_tier`) and **effort** (`effort`) are **parsed straight from the slug string** — not a hand-maintained side table — via `hosts.parseSlugSpeedEffort(slug)`. `-fast` suffix → `speed_tier: "fast"`; otherwise `"standard"` (chat UI "Fast" toggle off, or a family with no fast variant). `-thinking-high`/`-high` → `effort: "high"`, `-medium` → `"medium"`, `"n/a"` when the family has no effort suffix (Composer, Kimi).

| Slug | Role | Cost tier | Speed tier | Effort |
|------|------|-----------|------------|--------|
| `composer-2.5` | Chat UI Standard (light work) | low | standard | n/a |
| `composer-2.5-fast` | Task fallback for Composer | low | **fast** | n/a |
| `claude-sonnet-5-thinking-high` | General UI / mid Claude | medium | standard | high |
| `claude-opus-4-8-thinking-high` | Opus 4.8 (legacy) | medium-high | standard | high |
| `claude-opus-5-thinking-high` | Extreme difficulty (rare) | medium-high | standard | high |
| `claude-fable-5-thinking-high` | Urgent multi-file UI only (exception) | medium-high | standard | high |
| `cursor-grok-4.6-high-fast` | Design / planning (default Grok) | medium-high | **fast** | high |
| `cursor-grok-4.5-high-fast` | Grok 4.5 legacy | medium-high | **fast** | high |
| `gpt-5.6-sol-medium` | Lighter bug/CI probe | medium-high | standard | medium |
| `gpt-5.6-terra-medium` | Hard bug / Terra | high | standard | medium |
| `kimi-k2.7-code` | Long code context | medium | standard | n/a |

Notes:
- **Only Composer has a real Standard-vs-Fast pair today** (`composer-2.5` UI Standard vs `composer-2.5-fast` Task). Every other family's catalog slug is Fast-only (Grok) or has no Fast variant at all (Sonnet/Opus/Fable/Sol/Terra/Kimi) — for those, "standard" in the table above means "not a `-fast` slug", not "a verified non-Fast Task option exists". Grok 4.6/4.5 Standard (non-Fast) is chat-UI-only today (turn Fast off in the picker); there is no non-Fast Task slug yet — recheck against [Models & Pricing](https://cursor.com/docs/models-and-pricing).
- `effort` reflects the reasoning-effort suffix in the slug name (Anthropic "thinking-high", GPT "medium"), not a separate universal 3-level scale Cursor exposes for every model — some families (Composer, Kimi) simply don't have one (`n/a`).
- `recommend_model` / `start_session` results now include top-level `speed_tier` + `effort` (for the primary pick) and per-candidate `speed_tier`/`effort` on every `candidates[]` entry — see [Use it](#use-it) output shape below.
- "Lightest" depends on the host — Cursor's cheap slot is Composer, not Haiku. If the top pick isn't available, it falls back to the next in the list.

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

**한국어:** 작업 문장 보고 모델 추천하는 로컬 MCP (v0.9.10+). **우선순위: Composer → Grok → Sonnet · Fable 지양(토큰 큼, 긴급 멀티파일 UI·레이아웃 리팩터만 예외)**. `npm run connect -- cursor|claude|codex` 한 줄 설치, 또는 클론 없이 `curl -fsSL .../scripts/remote-install.sh | bash -s -- cursor`. **업데이트:** 클론 경로에서 `npm run sync` → Customize → MCPs OFF/ON. **간단 문자·카피·하이픈/구두점·i18n은 Composer 2.5 Standard(Fast 아님)** — Task slug는 `composer-2.5-fast` fallback. `copy_task_model`을 Task `model=`에 복사해야 함(말만 switch=위반). **v0.9.10:** Cursor pool 우선 정책(Composer 기본, Grok 설계·기획, mid UI Sonnet, Fable 강감점) + README §Update/deploy. 팀 전파: `docs/SHARE.md`(governance) 또는 이 README §Share.
