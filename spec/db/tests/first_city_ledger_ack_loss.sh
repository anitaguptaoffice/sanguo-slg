#!/usr/bin/env bash
# SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001 (#2579): disposable PG17 only.
set -euo pipefail
[[ ${ALLOW_OWNED_PG17_TEST:-} == 1 ]] || {
	echo 'Set ALLOW_OWNED_PG17_TEST=1 to run isolated-schema ACK-loss harness (never shared/production).'
	exit 1
}
root=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$root"
default_dsn='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
dsn="${FIRST_CITY_LEDGER_TEST_DSN:-}"
if [[ -z "$dsn" && -n "${DATABASE_URL:-}" ]]; then
	echo "warning: FIRST_CITY_LEDGER_TEST_DSN unset; using DATABASE_URL (must be disposable dev DB)"
	dsn="$DATABASE_URL"
fi
if [[ -z "$dsn" ]]; then
	echo "note: using default compose DSN ($default_dsn)"
	dsn="$default_dsn"
fi
[[ -n "$dsn" ]] || {
	echo 'FIRST_CITY_LEDGER_TEST_DSN or DATABASE_URL required'
	exit 1
}
"$root/spec/db/validate.sh"
export FIRST_CITY_LEDGER_TEST_DSN="$dsn" ALLOW_OWNED_PG17_TEST=1
exec env GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_ack_loss