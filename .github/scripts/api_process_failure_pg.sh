#!/usr/bin/env bash
set -euo pipefail
: "${MODE:?}" "${RUNNER_TEMP:?}"
[[ "$MODE" == ordinary || "$MODE" == race ]]
out="$RUNNER_TEMP/process-failure-evidence"
mkdir -p "$out"
exec > >(tee "$out/runner.log") 2>&1
keeper=$(cat <<'KEEPER'
set -euo pipefail
[[ -z "$(ls -A "$PGDATA")" && -z "$(ls -A /docker-entrypoint-initdb.d)" ]]
[[ ! -e /tmp/process-failure-pg-log ]]
for attempt in {1..600}; do
  [[ -f /tmp/keeper-start ]] && break
  sleep 0.1
done
[[ -f /tmp/keeper-start ]]
start_ticks() {
  local line fields
  read -r line < "/proc/$1/stat" || return 1
  read -ra fields <<< "${line##*) }"
  [[ "${fields[1]}" == 1 && "${fields[0]}" =~ ^[RSDI]$ && "${fields[19]}" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s\n' "${fields[19]}"
}
docker-entrypoint.sh postgres -c logging_collector=off -c listen_addresses='' > /tmp/initialization.log 2>&1 &
initial=$!
initial_ticks=$(start_ticks "$initial")
ready=0
for attempt in {1..600}; do
  [[ "$(start_ticks "$initial")" == "$initial_ticks" ]]
  if [[ "$(cat /proc/$initial/comm)" == postgres && -f "$PGDATA/postmaster.pid" ]] &&
    [[ "$(head -1 "$PGDATA/postmaster.pid")" == "$initial" ]] &&
    pg_isready -h /var/run/postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null; then
    ready=1
    break
  fi
  sleep 0.1
done
[[ "$ready" == 1 && "$(start_ticks "$initial")" == "$initial_ticks" ]]
[[ "$(psql -X -h /var/run/postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc 'SHOW logging_collector')" == off ]]
[[ "$(head -1 "$PGDATA/postmaster.pid")" == "$initial" ]]
gosu postgres pg_ctl -D "$PGDATA" -m fast -w -t 60 stop >> /tmp/initialization.log 2>&1
for attempt in {1..600}; do
  kill -0 "$initial" 2>/dev/null || break
  sleep 0.1
done
if kill -0 "$initial" 2>/dev/null; then exit 1; fi
wait "$initial"
[[ ! -e /proc/$initial && ! -e /tmp/process-failure-pg-log && -s "$PGDATA/PG_VERSION" ]]
printf '{"pid":%s,"start_ticks":%s,"collector":"off","ready":true,"reaped":true,"exit":0,"fresh_logs":true}\n' \
  "$initial" "$initial_ticks" > /tmp/initialization.json
docker-entrypoint.sh postgres "$@" &
postmaster=$!
trap 'kill -INT "$postmaster" 2>/dev/null || true' INT TERM
status=0
wait "$postmaster" || status=$?
trap - INT TERM
printf "%s\n" "$status" > /tmp/keeper-postmaster-status
while [[ ! -f /tmp/keeper-release ]]; do sleep 0.1; done
exit "$status"
KEEPER
)
PG_CONTAINER=$(docker run -d --entrypoint bash -p 127.0.0.1::5432 \
  -e POSTGRES_USER=sanguo -e POSTGRES_PASSWORD=sanguo -e POSTGRES_DB=sanguo \
  postgres:17 -c "$keeper" -- -c logging_collector=on -c log_destination=jsonlog \
  -c log_statement=all -c log_directory=/tmp/process-failure-pg-log \
  -c log_filename=evidence.log -c log_rotation_age=0 -c log_rotation_size=0 \
  -c log_truncate_on_rotation=off -c log_connections=on -c log_disconnections=on \
  -c log_timezone=UTC -c log_min_messages=debug1 -c "log_line_prefix=PROCESS_FALLBACK %p %c " \
  -c lc_messages=C -c log_error_verbosity=default)
[[ "$PG_CONTAINER" =~ ^[0-9a-f]{64}$ ]]
export PG_CONTAINER
printf '%s\n' "$PG_CONTAINER" > "$out/container-id.txt"
cleanup() {
  status=$?
  set +e
  if [[ "$status" != 0 ]]; then
    failed="$out/failed-capture"
    mkdir -p "$failed"
    printf 'FAILED RUN: best-effort diagnostic capture, never acceptance evidence\n' > "$failed/INCOMPLETE.txt"
    docker inspect "$PG_CONTAINER" > "$failed/container-before.json" 2>&1
    docker top "$PG_CONTAINER" > "$failed/processes.txt" 2>&1
    docker cp "$PG_CONTAINER:/tmp/initialization.log" "$failed/initialization.log" 2> "$failed/init-copy-error.log"
    python3 .github/scripts/api_process_failure_bootstrap.py drain "$failed" > "$failed/drain.log" 2>&1
  fi
  docker logs "$PG_CONTAINER" > "$out/container-output.log" 2>&1
  docker stop --time 5 "$PG_CONTAINER" > "$out/stop.log" 2>&1 || { [[ "$status" != 0 ]] || status=1; }
  if [[ -n "${failed:-}" ]]; then
    docker cp "$PG_CONTAINER:/tmp/process-failure-pg-log" - > "$failed/server.tar" 2> "$failed/copy-error.log"
    docker inspect "$PG_CONTAINER" > "$failed/container-after.json" 2>&1
  fi
  docker rm -v "$PG_CONTAINER" > "$out/disposal.log" 2>&1 || { [[ "$status" != 0 ]] || status=1; }
  exit "$status"
}
trap cleanup EXIT
docker exec "$PG_CONTAINER" cat /usr/local/bin/docker-entrypoint.sh > "$out/docker-entrypoint.sh"
test "$(git hash-object "$out/docker-entrypoint.sh")" = 8d507bc40798732dc89a1849ce5d80c451af4a1f
docker image inspect "$(docker inspect --format '{{.Image}}' "$PG_CONTAINER")" > "$out/image.json"
docker exec "$PG_CONTAINER" bash --version > "$out/bash-version.txt"
docker exec "$PG_CONTAINER" touch /tmp/keeper-start
port=$(docker port "$PG_CONTAINER" 5432/tcp)
port=${port##*:}
[[ "$port" =~ ^[0-9]+$ ]]
base="postgres://sanguo:sanguo@127.0.0.1:$port"
psql_owned() { docker exec "$PG_CONTAINER" psql -X -U sanguo -d sanguo -v ON_ERROR_STOP=1 "$@"; }
for attempt in {1..180}; do
  if PGPASSWORD=sanguo psql -X -h 127.0.0.1 -p "$port" -U sanguo -d sanguo -Atc 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$PG_CONTAINER" cat /tmp/initialization.json > "$out/initialization.json"
docker cp "$PG_CONTAINER:/tmp/initialization.log" "$out/initialization.log"
test "$(go env GOVERSION)" = go1.23.12
test "$(go env GOTOOLCHAIN)" = local
go version
for file in internal/api/recruit_cleanup_failure_guard_test.go \
  internal/api/recruit_cleanup_panic_process_pg_test.go \
  internal/api/recruit_cleanup_failure_process_pg_test.go; do
  printf 'Checking official Go 1.23.12 gofmt: %s\n' "$file"
  formatted=$(gofmt -l "$file")
  test -z "$formatted"
done
version=$(psql_owned -Atc 'SHOW server_version_num')
(( version / 10000 == 17 ))
command -v psql
git rev-parse HEAD HEAD^{tree} > "$out/source.txt"
git diff --exit-code
python3 .github/scripts/test_process_failure_evidence.py > "$out/validator-unit-controls.txt"
psql_owned -Atc "SELECT name || '=' || setting FROM pg_settings WHERE name IN
  ('logging_collector','log_destination','log_statement','log_directory','log_filename',
   'log_rotation_age','log_rotation_size','log_truncate_on_rotation','log_connections','log_disconnections','log_timezone','log_min_messages','log_line_prefix','lc_messages','log_error_verbosity') ORDER BY name" > "$out/settings.txt"
control() {
  psql_owned -c "SELECT 'PROCESS_LOG_$1'; CREATE SCHEMA process_log_$1; DROP SCHEMA process_log_$1"
}
control begin
for db in process_green process_red process_bootstrap process_success; do psql_owned -c "CREATE DATABASE $db"; done
flags=()
if [[ "$MODE" == race ]]; then flags=(-race); fi
go test ./internal/api "${flags[@]}" -c -o "$out/green.test"
export DATABASE_URL="$base/process_green?sslmode=disable"
pattern='^(TestRecruitCleanupFailureGuard|TestRecruitCleanupFailureRunner|TestRecruitFailureOwnershipRejectsIncomplete|TestRecruitFailureAbsenceRequiresReap|TestPGRecruitFailureAbsenceRejectsLiveBackend|TestPGRecruitCleanupFailureProcess|TestRecruitPanicAbsenceRejectsInvalidIdentity)$'
go tool test2json -t -p api "$out/green.test" -test.v -test.count=1 -test.timeout=8m -test.run="$pattern" > "$out/green.json"
export DATABASE_URL="$base/process_success?sslmode=disable"
go tool test2json -t -p api "$out/green.test" -test.v -test.count=1 -test.timeout=2m -test.run='^TestPGRecruitGenerationConstructorCleanupPanic$' > "$out/success.json"
export DATABASE_URL="$base/process_bootstrap?sslmode=disable"
python3 .github/scripts/api_process_failure_bootstrap.py bootstrap "$out"
for attempt in {1..100}; do
  remaining=$(psql_owned -Atc "SELECT count(*) FROM pg_stat_activity WHERE datname='process_bootstrap'")
  if [[ "$remaining" == 0 ]]; then break; fi
  sleep 0.1
done
test "$remaining" = 0
psql_owned -c "SELECT 'PROCESS_BOOTSTRAP_REAP_ABSENT'"
red="$RUNNER_TEMP/process-failure-red"
mkdir -p "$red"
git archive HEAD | tar -x -C "$red"
python3 - "$red/internal/api/recruit_cleanup_panic_process_pg_test.go" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
needle = 'recruitPanicGuardedChild(t, recruitCleanupPanicChild)'
assert s.count(needle) == 1
p.write_text(s.replace(needle, 'recruitCleanupPanicChild(t)', 1))
PY
diff -u internal/api/recruit_cleanup_panic_process_pg_test.go "$red/internal/api/recruit_cleanup_panic_process_pg_test.go" > "$out/red.patch" || test "$?" = 1
(cd "$red" && go test ./internal/api "${flags[@]}" -c -o "$out/red.test")
sha256sum "$out/green.test" "$out/red.test" > "$out/binaries.sha256"
export DATABASE_URL="$base/process_red?sslmode=disable"
set +e
go tool test2json -t -p api "$out/red.test" -test.v -test.count=1 -test.timeout=2m -test.run='^TestPGRecruitCleanupFailureProcess$/^original_fatal$' > "$out/red.json"
red_status=$?
set -e
test "$red_status" = 1
control end
python3 .github/scripts/api_process_failure_bootstrap.py drain "$out"
docker cp "$PG_CONTAINER:/tmp/process-failure-pg-log" - > "$out/server.tar"
mkdir -p "$out/server"
tar -xf "$out/server.tar" --strip-components=1 -C "$out/server"
(cd "$out/server" && sha256sum *) > "$out/log-inventory.txt"
python3 .github/scripts/api_process_failure_bootstrap.py archived "$out"
docker exec "$PG_CONTAINER" touch /tmp/keeper-release
test "$(docker wait "$PG_CONTAINER")" = 0
docker inspect "$PG_CONTAINER" > "$out/container.json"
python3 .github/scripts/verify_api_process_failure.py "$out"
