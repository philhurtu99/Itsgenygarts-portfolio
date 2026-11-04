#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_PORT="${ADMIN_PORT:-3002}"
API_PORT="${API_PORT:-3001}"
if [ -z "${LAN_IP:-}" ]; then
  echo "Set LAN_IP to this computer's local network address, then run npm run mobile:admin."
  exit 1
fi
export EXPO_PUBLIC_ADMIN_URL="http://$LAN_IP:$ADMIN_PORT"
export EXPO_PUBLIC_API_URL="http://$LAN_IP:$API_PORT/api"
VITE_API_URL="$EXPO_PUBLIC_API_URL" npm --prefix "$ROOT_DIR/admin" run dev -- --host 0.0.0.0 --port "$ADMIN_PORT" --strictPort &
ADMIN_PID=$!
trap 'kill "$ADMIN_PID" 2>/dev/null || true' EXIT INT TERM
npm --prefix "$ROOT_DIR/mobile-admin" run lan
