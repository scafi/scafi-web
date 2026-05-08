#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend-ts"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4173}"

find_available_port() {
  local host="$1"
  local port="$2"

  while python3 - "$host" "$port" <<'PY' >/dev/null 2>&1
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    sock.bind((host, port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
  do
    echo "$port"
    return 0
  done

  port=$((port + 1))
  find_available_port "$host" "$port"
}

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "frontend-ts/package.json not found" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "=== Installing frontend-ts dependencies ==="
  npm --prefix "$FRONTEND_DIR" install
  echo ""
fi

SELECTED_PORT="$(find_available_port "$HOST" "$PORT")"

if [[ "$SELECTED_PORT" != "$PORT" ]]; then
  echo "=== Port $PORT is busy, using $SELECTED_PORT instead ==="
fi

echo "=== Starting frontend-ts dev server ==="
echo "Frontend dir: $FRONTEND_DIR"
echo "URL: http://$HOST:$SELECTED_PORT/"

npm --prefix "$FRONTEND_DIR" run dev -- --host "$HOST" --port "$SELECTED_PORT" "$@"