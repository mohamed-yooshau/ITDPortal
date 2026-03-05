#!/usr/bin/env bash
set -euo pipefail

TS=$(date +%Y%m%d_%H%M%S)
OUT_DIR=${1:-/opt/it-portal/exports}
FILE="$OUT_DIR/itdportal_db_$TS.sql"

mkdir -p "$OUT_DIR"

docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$FILE"

echo "Backup written: $FILE"
