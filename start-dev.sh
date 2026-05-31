#!/usr/bin/env bash
# Starts local Postgres (if not already running) and the Next.js dev server.
set -e

PG_BIN="$HOME/.local/pgsql/bin"
PG_DATA="$HOME/.local/pgdata"
NODE_BIN="$HOME/.local/node/bin"

export PATH="$PG_BIN:$NODE_BIN:$PATH"

# Start Postgres only if it's not already running
if ! pg_ctl -D "$PG_DATA" status > /dev/null 2>&1; then
  echo "Starting Postgres..."
  pg_ctl -D "$PG_DATA" -l "$PG_DATA/postgres.log" start
else
  echo "Postgres already running."
fi

echo "Starting Next.js dev server..."
cd "$HOME/skillhub" && npm run dev
