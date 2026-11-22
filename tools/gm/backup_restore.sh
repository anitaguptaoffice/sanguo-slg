#!/usr/bin/env bash
# GM backup/restore drill: dump, restore into a scratch database, verify core invariants.
set -euo pipefail

usage() {
  cat <<'USAGE'
usage:
  backup_restore.sh backup  <database> <dump-file>
  backup_restore.sh verify  <database> <dump-file>
  backup_restore.sh restore <database> <dump-file> --force

Environment: PGHOST/PGPORT/PGUSER/PGPASSWORD or DATABASE_URL.
USAGE
}

export PGHOST=${PGHOST:-127.0.0.1}
export PGPORT=${PGPORT:-5432}
export PGUSER=${PGUSER:-sanguo}
cmd=${1:-}
db=${2:-}
dump=${3:-}
if [[ -z "$cmd" || -z "$db" || -z "$dump" ]]; then usage; exit 2; fi

psql_db() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    local base=${DATABASE_URL%%\?*}
    local prefix=${base%/*}
    PGPASSWORD=${PGPASSWORD:-} psql "$prefix/$1" "${@:2}"
  else
    PGPASSWORD=${PGPASSWORD:-} psql -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5432}" -U "${PGUSER:-sanguo}" -d "$1" "${@:2}"
  fi
}

case "$cmd" in
  backup)
    pg_dump --format=custom --no-owner --no-privileges --file "$dump" "$db"
    echo "backup: $dump ($(du -h "$dump" | cut -f1))"
    ;;
  verify)
    scratch="${db}_restorecheck"
    dropdb --if-exists "$scratch" 2>/dev/null || true
    createdb "$scratch"
    pg_restore --no-owner --no-privileges --dbname "$scratch" "$dump"
    psql_db "$scratch" -v ON_ERROR_STOP=1 -tAc "
      SELECT 'migrations=' || count(*) FROM schema_migrations;
      SELECT 'players=' || count(*) FROM player;
      SELECT 'cities=' || count(*) FROM player_city;
      SELECT 'accounts=' || count(*) FROM account;
      SELECT 'orphan_cities=' || count(*) FROM player_city c
        LEFT JOIN player p ON p.server_id=c.server_id AND p.player_id=c.player_id
        WHERE p.player_id IS NULL;"
    dropdb "$scratch"
    echo "verify: OK"
    ;;
  restore)
    if [[ "${4:-}" != "--force" ]]; then
      echo "restore requires --force (destructive)" >&2
      exit 2
    fi
    dropdb --if-exists "$db"
    createdb "$db"
    pg_restore --no-owner --no-privileges --dbname "$db" "$dump"
    echo "restore: $db OK"
    ;;
  *)
    usage; exit 2;;
esac
