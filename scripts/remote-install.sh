#!/usr/bin/env bash
# One-command remote install/update for compass-mcp — no manual `git clone` first.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/JakeLim17/compass-mcp/main/scripts/remote-install.sh \
#     | bash -s -- cursor
#   curl -fsSL .../remote-install.sh | bash -s -- claude
#   curl -fsSL .../remote-install.sh | bash -s -- codex
#
# Clones (or fast-forward pulls if already cloned) into
#   ${COMPASS_MCP_LOCAL_DIR:-~/.compass-mcp}, then runs `npm run connect -- <host>`
#   from that clone — npm install + build happen inside scripts/connect.ts, same
#   as the manual `git clone && npm run connect -- <host>` flow in README.md.
#
# Override clone location: COMPASS_MCP_LOCAL_DIR=/some/path
# Override source repo:    COMPASS_MCP_REPO_URL=...
#
# Already have a local clone and just want the latest version + rebuild + MCP
# re-register? Same command re-run does a fast-forward `git pull` first —
# equivalent to `npm run sync` but also re-runs `npm run connect`.

set -euo pipefail

HOST="${1:-cursor}"
REPO_URL="${COMPASS_MCP_REPO_URL:-https://github.com/JakeLim17/compass-mcp.git}"
LOCAL_DIR="${COMPASS_MCP_LOCAL_DIR:-$HOME/.compass-mcp}"

case "$HOST" in
  cursor|claude|codex|openai) ;;
  * )
    echo "usage: remote-install.sh <cursor|claude|codex>" >&2
    echo "   or: COMPASS_MCP_LOCAL_DIR=/path COMPASS_MCP_REPO_URL=... remote-install.sh <host>" >&2
    exit 1
    ;;
esac

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm (Node.js >=20) is required" >&2
  exit 1
fi

if [[ -d "$LOCAL_DIR/.git" ]]; then
  echo "==> updating existing clone: $LOCAL_DIR"
  git -C "$LOCAL_DIR" pull --ff-only
else
  echo "==> cloning $REPO_URL -> $LOCAL_DIR"
  git clone "$REPO_URL" "$LOCAL_DIR"
fi

cd "$LOCAL_DIR"
echo "==> npm run connect -- $HOST"
npm run connect -- "$HOST"
