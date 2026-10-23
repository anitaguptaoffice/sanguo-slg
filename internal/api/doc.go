// Package api wires account, world, and domestic handlers for the WebSocket gateway.
//
// GM (GM-001): GmService + cmd/gm subcommands; optional JSON via MountGmHTTP.
// M4 (INTG-004): WireM4Content registers quest.v1 / shop.v1 routes on assembly.M4.
//
// Smoke (requires Postgres from docker compose):
//
//	DATABASE_URL=postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable \
//	  go test ./internal/api -run TestLoginCreateCityUpgradeFlow -count=1 -v
package api
