#!/usr/bin/env bash
set -euo pipefail

FILE=${1:-}
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 /path/to/backup.sql" >&2
  exit 1
fi

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < "$FILE"

echo "Restore completed: $FILE"
