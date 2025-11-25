#!/bin/bash
# Launch Polypane with remote debugging enabled for MCP integration
# Usage: ./scripts/polypane-debug.sh

echo "Starting Polypane with remote debugging on port 5858..."
echo "Make sure the 'polypane-mcp' server is enabled in VS Code."
echo ""

/Applications/Polypane.app/Contents/MacOS/Polypane --remote-debugging-port=5858
