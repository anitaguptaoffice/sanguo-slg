// Package api wires account, world, and domestic handlers for the WebSocket gateway.
//
// GM (GM-001): GmService + cmd/gm subcommands; optional JSON via MountGmHTTP.
// M4 (INTG-004): WireM4Content registers quest.v1 / shop.v1 routes on assembly.M4.
// INTG-005: TestINTG005Wave7SmokePath reruns M3/M4 with DATA-001 seeds, PG persistence, and restart.
// API-ONBOARD-001: login, server entry and normal bag/quest reads retry the fixed
// starter-scroll grant. A successful response's bounded msg is display-only;
// absence of msg never confirms delivery. No in-memory eligibility is durable.
// Starter delivery also waits for both player and initial wallet to exist, so
// concurrent login cannot replace unfinished bootstrap funding with a zero wallet.
// Release still requires item-only Grant wallet-clock safety and recruit gates.
// API-ONBOARD-002: tutorial facts come from shard/owner-scoped persisted city
// levels and all-status heroes. Accept/list/chain reads reconcile in quest;
// successful recruit/build hooks retry reconciliation without failing committed
// actions. Public progress mutation is rejected; trusted daily events remain.
// Claim proof/receipt enforcement and player-level persistence are separate gates.
//
// API-ONBOARD-003: completed contiguous chain100 milestones repair player.level
// monotonically on login/entry, quest reads/unlocks and post-receipt Claim. Claim
// replies expose only a persisted level; duplicate claims retain their error.
//
// Smoke (requires Postgres from docker compose); full commands in tools/smoke/README.md:
//
//	DATABASE_URL=postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable \
//	  GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestINTG005Wave7SmokePath -count=1 -v
package api
