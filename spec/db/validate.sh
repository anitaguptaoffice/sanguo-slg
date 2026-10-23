#!/usr/bin/env bash
# SPEC-001 / SPEC-005: 对 spec/db 下 DDL 做 PostgreSQL 语法校验（同一 schema 内按序执行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FILES=("$ROOT"/00*.sql "$ROOT"/m3_*.sql)
SCHEMA=spec_db_validate

run_psql() {
  local psql_cmd=("$@")
  "${psql_cmd[@]}" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;" \
    -c "CREATE SCHEMA ${SCHEMA};" \
    -c "SET search_path TO ${SCHEMA};"
  for f in "${FILES[@]}"; do
    echo "==> $f"
    "${psql_cmd[@]}" -d postgres -v ON_ERROR_STOP=1 \
      -c "SET search_path TO ${SCHEMA};" \
      -f "$f"
  done
  "${psql_cmd[@]}" -d postgres -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;"
  echo "All SQL files passed syntax check."
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
  docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<EOF
DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
CREATE SCHEMA ${SCHEMA};
SET search_path TO ${SCHEMA};
EOF
  for f in "${FILES[@]}"; do
    echo "==> $f"
    docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "SET search_path TO ${SCHEMA};" -f - <"$f"
  done
  docker exec -i "$CID" psql -U postgres -d postgres -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;"
  echo "All SQL files passed syntax check (docker postgres:16)."
else
  echo "ERROR: need psql or docker for validation" >&2
  exit 1
fi
