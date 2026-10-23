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
