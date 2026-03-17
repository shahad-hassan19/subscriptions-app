#!/bin/sh
set -eu

MIGRATION_NAME="${PRISMA_BASELINE_MIGRATION:-20260317071009_init}"

echo "Running Prisma migrations (deploy)…"

set +e
OUT="$(npx prisma migrate deploy 2>&1)"
CODE="$?"
set -e

if [ "$CODE" -eq 0 ]; then
  echo "$OUT"
  echo "Migrations applied."
else
  echo "$OUT"

  # If the DB already has tables but no Prisma migration history, baseline it.
  if echo "$OUT" | grep -q "P3005"; then
    echo "Detected P3005 (non-empty schema). Baselining with migration: $MIGRATION_NAME"
    npx prisma migrate resolve --applied "$MIGRATION_NAME"
    npx prisma migrate deploy
  else
    exit "$CODE"
  fi
fi

echo "Starting server…"
exec node dist/index.js

