// Package api wires account, world, and domestic handlers for the WebSocket gateway.
//
// Smoke (requires Postgres from docker compose):
//
//	DATABASE_URL=postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable \
//	  go test ./internal/api -run TestLoginCreateCityUpgradeFlow -count=1 -v
package api
