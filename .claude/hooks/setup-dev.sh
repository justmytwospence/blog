#!/bin/bash

# Start Polypane with remote debugging if not already running
if ! pgrep -f "Polypane.*5858" > /dev/null 2>&1; then
  open -a Polypane --args --remote-debugging-port=5858
fi

# Start npm dev server if not already running on port 3000
if ! lsof -iTCP:3000 -sTCP:LISTEN > /dev/null 2>&1; then
  cd "$CLAUDE_PROJECT_DIR" && npm run dev > /dev/null 2>&1 &
fi

echo "Dev environment ready: Polypane (port 5858) + dev server (port 3000)"
