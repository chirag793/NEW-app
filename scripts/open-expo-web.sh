#!/usr/bin/env bash
# Start expo in web mode and open the browser to the dev server URL
# Usage: ./scripts/open-expo-web.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# Start expo in the background and give it a moment to boot, then open browser
expo start --web &
EXPO_PID=$!
# Wait for the dev server to be available
URL="http://localhost:19006"
for i in {1..30}; do
  if curl -s --head "$URL" | head -n 1 | grep "200\|302" >/dev/null; then
    # open the browser (works in Linux devcontainer)
    if command -v xdg-open >/dev/null; then
      xdg-open "$URL" || true
    else
      echo "Open your browser at: $URL"
    fi
    exit 0
  fi
  sleep 1
done
# If we get here, expo didn't start in time; print logs and exit
echo "Expo dev server didn't respond at $URL after waiting; check the terminal output for expo (PID $EXPO_PID)"
wait $EXPO_PID
