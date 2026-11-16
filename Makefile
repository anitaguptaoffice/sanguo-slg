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

# --- Layered local gates -----------------------------------------------------
# fast:  seconds. No database. Use while editing.
# gate:  ~1 min. Real PostgreSQL for the changed domains + full client suite.
# full:  release points only. Whole API PG suite and browser acceptance.
DATABASE_URL ?= postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable
NODE ?= node

test-fast:
	go build ./...
	go vet ./...
	go test -count=1 ./...
	cd client && NODE_ENV=development npx tsc --noEmit && npx vitest run

test-gate:
	DATABASE_URL='$(DATABASE_URL)' go test -short -count=1 -timeout=20m ./internal/api ./internal/domestic ./internal/world
	cd client && NODE_ENV=development npx vitest run && NODE_ENV=development npx vite build

test-full:
	DATABASE_URL='$(DATABASE_URL)' go test -count=1 -timeout=40m ./internal/api
