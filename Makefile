.PHONY: build build-gm test lint dev dev-down tidy load-ws load-ws-external

BINARY := bin/server
GM_BINARY := bin/gm

build:
	@mkdir -p bin
	go build -o $(BINARY) ./cmd/server

build-gm:
	@mkdir -p bin
	go build -o $(GM_BINARY) ./cmd/gm

test:
	go test ./...

# PLAT-002 / LOAD-001: embedded gateway stress (no running server required).
load-ws:
	go test ./tools/load/wsstress -run TestStress3000Embedded -count=1 -timeout 15m

# Stress against a live gateway; requires LOAD_WS_URL (and optional LOAD_* env vars).
load-ws-external:
	go test ./tools/load/wsstress -run TestStress3000External -count=1 -timeout 15m

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

dev: dev-up
	@echo "Starting server (Ctrl+C to stop; run 'make dev-down' to stop containers)..."
	go run ./cmd/server

dev-up:
	docker compose up -d --wait

dev-down:
	docker compose down

# --- Layered local gates (see docs/TESTING-TIERS.md) -------------------------
# test-fast:  T0, -short, no full-spec PG.
# test-gate:  T1, warm schema + domain tests + client.
# test-full:  T2, all internal/api PG (slow).
DATABASE_URL ?= postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable
# Reuse one ApplySpecs schema per test process (TRUNCATE between tests). Set to 0 to force slow per-test schemas.
export SANGUO_PG_REUSE_SPEC ?= 1
GO_TEST_PARALLEL ?= $(shell nproc 2>/dev/null || echo 4)
NODE ?= node

test-fast:
	go build ./...
	go vet ./...
	go test -short -count=1 -p $(GO_TEST_PARALLEL) ./...
	cd client && NODE_ENV=development npx tsc --noEmit && npx vitest run

test-gate:
	DATABASE_URL='$(DATABASE_URL)' go test -short -count=1 -p $(GO_TEST_PARALLEL) -timeout=20m ./internal/api ./internal/domestic ./internal/world
	DATABASE_URL='$(DATABASE_URL)' go test -count=1 -p $(GO_TEST_PARALLEL) -timeout 8m ./internal/api -run 'TestFirstCitySubmitCreatesCityPG$|TestFirstCityPG'
	cd client && NODE_ENV=development npx vitest run && NODE_ENV=development npx vite build
	@if [ "$${ALLOW_OWNED_PG17_TEST:-}" = "1" ]; then \
	  dsn="$${FIRST_CITY_LEDGER_TEST_DSN:-$${DATABASE_URL:-$(FC_ACK_DEFAULT_DSN)}}"; \
	  ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN="$$dsn" bash spec/db/tests/first_city_ledger_ack_loss.sh; \
	  ALLOW_OWNED_PG17_TEST=1 DATABASE_URL="$$dsn" FIRST_CITY_LEDGER_TEST_DSN="$$dsn" \
	    go test -count=1 -timeout=5m ./internal/api -run TestSpecFirstCityLedgerAckLossHarness; \
	fi

test-full:
	DATABASE_URL='$(DATABASE_URL)' go test -count=1 -p $(GO_TEST_PARALLEL) -timeout=40m ./internal/api

# SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001 (#2579): disposable PG17; creates fc_ack_* schemas only.
FC_ACK_DEFAULT_DSN := postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable
# First-city PG: warm schema sanguo_api_fixture_v1 (first run may apply spec once; later runs are seconds).
test-fc-pg:
	DATABASE_URL='$(DATABASE_URL)' SANGUO_PG_REUSE_SPEC=1 go test -count=1 -timeout 3m -p 1 ./internal/api -run 'TestFirstCitySubmitCreatesCityPG$$'

# PreparedCity PG: MIL extras install once per warm schema (pgx only, no psql).
test-pg-warm-mil:
	DATABASE_URL='$(DATABASE_URL)' SANGUO_PG_REUSE_SPEC=1 go test -count=1 -timeout 2m -p 1 ./internal/api -run TestWarmFirstCityPreparedMilDDL

test-fc-prepared-pg:
	DATABASE_URL='$(DATABASE_URL)' SANGUO_PG_REUSE_SPEC=1 SANGUO_FIRST_CITY_PREPARED_PG_TEST=1 go test -count=1 -timeout 2m -p 1 ./internal/api -run 'TestFirstCitySubmitCreatesCityPreparedPG$$|TestWarmFirstCityPreparedMilDDL'

test-spec-fc-ack-loss:
	@: $${ALLOW_OWNED_PG17_TEST:?set ALLOW_OWNED_PG17_TEST=1}; \
	dsn="$${FIRST_CITY_LEDGER_TEST_DSN:-$${DATABASE_URL:-$(FC_ACK_DEFAULT_DSN)}}"; \
	ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN="$$dsn" bash spec/db/tests/first_city_ledger_ack_loss.sh
