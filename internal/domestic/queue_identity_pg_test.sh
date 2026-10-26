#!/usr/bin/env bash
# Disposable TCP-only PG lifecycle; never uses an existing DATABASE_URL/service.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH=/tmp/sanguo-toolchain/go/bin:/tmp/sanguo-toolchain/pg/bin:$PATH
export GOPATH=/tmp/sanguo-toolchain/gopath GOCACHE=/tmp/sanguo-go-cache GOPROXY=off
fixture=$(mktemp -d /tmp/dom-queue-pg.XXXXXX)
cleanup() {
  pg_ctl -D "$fixture/data" -m fast -w stop >/dev/null 2>&1 || true
  rm -rf "$fixture"
}
trap cleanup EXIT
initdb -D "$fixture/data" -A trust --no-locale --encoding=UTF8 --wal-segsize=1 >/dev/null
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
cat >> "$fixture/data/postgresql.conf" <<CONF
listen_addresses='127.0.0.1'
unix_socket_directories=''
port=$port
max_connections=30
shared_buffers='16MB'
max_wal_size='64MB'
min_wal_size='32MB'
fsync=on
CONF
pg_ctl -D "$fixture/data" -l "$fixture/pg.log" -w start >/dev/null
createdb -h 127.0.0.1 -p "$port" domestic_test
export DATABASE_URL="postgres://$(id -un)@127.0.0.1:$port/domestic_test?sslmode=disable"
go test -race ./internal/domestic -count=1
go vet ./internal/domestic
DOM_QUEUE_RESTART_PHASE=prepare go test ./internal/domestic -run '^TestPGQueuePhysicalRestart$' -v -count=1
pg_ctl -D "$fixture/data" -m fast -w stop
pg_ctl -D "$fixture/data" -l "$fixture/pg.log" -w start
DOM_QUEUE_RESTART_PHASE=resume go test ./internal/domestic -run '^TestPGQueuePhysicalRestart$' -v -count=1
