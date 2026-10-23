.PHONY: build build-gm test lint dev dev-down tidy

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
