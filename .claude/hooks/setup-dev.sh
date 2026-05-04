#!/bin/bash
# Started by .claude/settings.json on SessionStart.
# Brings up Polypane (Chrome DevTools MCP target) and the Next.js dev server.
# Reports honestly when something else is holding the expected port.

set -u

POLYPANE_PORT=5858
DEV_PORT=3000

# Polypane: launch only if not already exposing the debugging port.
if ! pgrep -f "Polypane.*${POLYPANE_PORT}" > /dev/null 2>&1; then
  open -a Polypane --args --remote-debugging-port="${POLYPANE_PORT}" 2>/dev/null
  polypane_status="started on port ${POLYPANE_PORT}"
else
  polypane_status="already running on port ${POLYPANE_PORT}"
fi

# Dev server: only spawn if no listener on the port. If something
# else is on 3000, say so instead of pretending we own it.
dev_owner_pid=$(lsof -tiTCP:${DEV_PORT} -sTCP:LISTEN 2>/dev/null | head -1)
if [ -z "$dev_owner_pid" ]; then
  (cd "$CLAUDE_PROJECT_DIR" && npm run dev > /tmp/blog-dev.log 2>&1 &)
  dev_status="started on port ${DEV_PORT} (logs: /tmp/blog-dev.log)"
else
  owner_cmd=$(ps -o command= -p "$dev_owner_pid" 2>/dev/null | head -c 60)
  if pgrep -f "next dev" -P "$dev_owner_pid" > /dev/null 2>&1 || echo "$owner_cmd" | grep -q "next dev\|node.*next"; then
    dev_status="already running on port ${DEV_PORT}"
  else
    dev_status="WARNING: port ${DEV_PORT} is held by another process (pid ${dev_owner_pid}: ${owner_cmd}); skipped 'npm run dev'"
  fi
fi

echo "Polypane: ${polypane_status}"
echo "Dev server: ${dev_status}"
