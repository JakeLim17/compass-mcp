#!/usr/bin/env bash
# npm run sync — pull latest, build, remind to refresh MCP
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
echo "==> Compass MCP sync (v${VERSION})"
echo "    path: $ROOT"
echo ""

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> git pull --ff-only origin main (or master)"
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    git pull --ff-only origin main || {
      echo "WARN: pull failed — fix conflicts then re-run npm run sync" >&2
      exit 1
    }
  elif git show-ref --verify --quiet refs/remotes/origin/master; then
    git pull --ff-only origin master || {
      echo "WARN: pull failed — fix conflicts then re-run npm run sync" >&2
      exit 1
    }
  else
    echo "    (no origin/main or origin/master — skip pull)"
  fi
else
  echo "    (not a git repo — skip pull)"
fi

echo ""
echo "==> npm install"
npm install

echo ""
echo "==> npm run build"
npm run build

echo ""
echo "==> npm test (smoke)"
npm test

echo ""
echo "Done. v$(node -p "require('./package.json').version")"
echo ""
echo "Next: refresh MCP so Cursor picks up changes:"
echo "  • Ask agent: how_to_refresh_mcp (host: cursor)"
echo "  • Or: Cmd/Ctrl+Shift+J → Tools & MCP → compass-mcp OFF/ON"
echo ""
