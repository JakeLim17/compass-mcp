#!/usr/bin/env bash
# Compass MCP local setup — npm i + print mcp.json snippets (not published to npm yet).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Compass MCP setup"
echo "    path: $ROOT"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found (need >= 20)" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node >= 20 required (found $(node -v))" >&2
  exit 1
fi

echo "==> npm install"
npm install

echo ""
echo "==> Optional: npm run typecheck / npm test"
echo ""

ABS="$ROOT"
CURSOR_SNIPPET=$(cat <<EOF
{
  "mcpServers": {
    "compass-mcp": {
      "command": "npx",
      "args": [
        "tsx",
        "${ABS}/src/server.ts"
      ]
    }
  }
}
EOF
)

CLAUDE_SNIPPET=$(cat <<EOF
{
  "mcpServers": {
    "compass-mcp": {
      "command": "npx",
      "args": [
        "tsx",
        "${ABS}/src/server.ts"
      ],
      "env": {
        "COMPASS_MCP_HOST": "claude"
      }
    }
  }
}
EOF
)

echo "========== Cursor: merge into ~/.cursor/mcp.json =========="
echo "$CURSOR_SNIPPET"
echo ""
echo "========== Claude Desktop: claude_desktop_config.json =========="
echo "$CLAUDE_SNIPPET"
echo ""
echo "Next:"
echo "  1) Paste the snippet (merge mcpServers.compass-mcp)"
echo "  2) Then refresh MCP — ask agent how_to_refresh_mcp"
echo "     (Cursor: Cmd/Ctrl+Shift+J → Tools & MCP → toggle OFF/ON)"
echo "  3) Prefer start_session at work start; or get_sticky → recommend_model → log_model_usage → set_sticky"
echo ""
echo "Data dir: ~/.cursor/compass-mcp/  (sticky.json, usage.jsonl, feedback.jsonl)"
echo "Done."
