#!/usr/bin/env bash
# SPEC-001: 对 spec/db/*.sql 做 PostgreSQL 语法校验（CREATE 干跑）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FILES=("$ROOT"/00*.sql)

run_psql() {
  local psql_cmd=("$@")
  for f in "${FILES[@]}"; do
    echo "==> $f"
    "${psql_cmd[@]}" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP SCHEMA IF EXISTS spec001_validate CASCADE;" \
      -c "CREATE SCHEMA spec001_validate;" \
      -c "SET search_path TO spec001_validate;" \
      -f "$f"
  done
  "${psql_cmd[@]}" -d postgres -c "DROP SCHEMA IF EXISTS spec001_validate CASCADE;"
}

if command -v psql >/dev/null 2>&1 && psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  run_psql psql
elif command -v psql >/dev/null 2>&1 && sudo -u postgres psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  run_psql sudo -u postgres psql
elif docker info >/dev/null 2>&1; then
  CID=$(docker run -d --rm -e POSTGRES_PASSWORD=spec001 postgres:16-alpine)
  trap 'docker stop "$CID" >/dev/null 2>&1 || true' EXIT
  for i in $(seq 1 30); do
    docker exec "$CID" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec -e PGPASSWORD=spec001 "$CID" psql -U postgres -d postgres -c 'SELECT 1' >/dev/null
  for f in "${FILES[@]}"; do
    echo "==> $f"
    docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<EOF
DROP SCHEMA IF EXISTS spec001_validate CASCADE;
CREATE SCHEMA spec001_validate;
SET search_path TO spec001_validate;
$(cat "$f")
EOF
  done
  echo "All SQL files passed syntax check (docker postgres:16)."
else
  echo "ERROR: need psql or docker for validation" >&2
  exit 1
fi
