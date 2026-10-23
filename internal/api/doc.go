// Package api wires account, world, and domestic handlers for the WebSocket gateway.
//
// GM (GM-001): GmService + cmd/gm subcommands; optional JSON via MountGmHTTP.
// M4 (INTG-004): WireM4Content registers quest.v1 / shop.v1 routes on assembly.M4.
// INTG-005: TestINTG005Wave7SmokePath reruns M3/M4 with DATA-001 seeds, PG persistence, and restart.
//
// Smoke (requires Postgres from docker compose); full commands in tools/smoke/README.md:
//
//	DATABASE_URL=postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable \
//	  GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestINTG005Wave7SmokePath -count=1 -v
package api
