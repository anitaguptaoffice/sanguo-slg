# Random hotel hero potential capability

Task: [CLIENT-HOTEL-POINT-CAPABILITY-001 / #2082](https://github.com/anitaguptaoffice/sanguo-slg/issues/2082).
Base: `10d57ddf9b7216aa44066baee76cf60c56761ac4`. New client implementation, no imported or held changes.

## Existing server boundary

- `internal/hero/hotel.go` and `hotel_plan.go` recruit natural hotel candidates with `TemplateCfgIDHotelRandom` (0).
- `internal/hero/player_ops.go` returns explicit `template_code = hotel_random` for their detail.
- Both `AddHeroPointPlayer` and `ClearHeroPointPlayer` in `internal/hero/points.go` call `ownedTemplateHero`, which rejects these heroes with `ErrUnknownTemplate` before applying or saving points.
- `internal/api/hero_handlers.go`, the production hero protobuf and `GatewayClient.getHeroDetail` retain that explicit code. Missing allocation fields still mean unknown, not zero.

## Client behavior

The shared `heroPointUnsupportedReason` recognizes only the exact `hotel_random` code. Existing add/reset controls, their existing reason labels and the submit entry use that rule. The summary explains the restriction instead of inviting server-validated allocation for a known unsupported hero. No new controls or layout are introduced.

Missing identity, a zero template ID without that code, and fixed-template unknown allocation remain server-validated as in #2075. Known empty/exhausted allocations and idle/pending checks retain their behavior. The submit guard runs after target/detail and per-actor pending ownership checks, before acquiring a request or sending either RPC. Switching heroes or refreshing detail recomputes capability; supported receipts remain bound to their original actor and hero.

## Verification boundary

The mounted regression uses the actual `GatewayClient` and production protobuf with transport fixtures. Before implementation, six desired capability/direct-entry/navigation cases failed while four identity controls passed. The discovery probe also observed both operations reaching the simulated exact server rejection. Server source inspection establishes why that rejection is inevitable; these are not live backend tests.

Coverage includes all four buttons, visible reasons, direct add/reset entry, absent/zero/fixed identity, successful fixed-template operations, target and detail changes, and pending add/reset ownership while visiting a hotel hero. Existing point-knowledge and point-ownership suites remain unchanged. Run focused tests, full client tests with `--maxWorkers=2`, then the build serially.

No backend/protobuf/economy/catalog changes, local point invention, auto retry, upgrade behavior, or deployment. Independent final-source review, isolated held-#2004 combination validation, and exact-head required CI remain separate gates. Browser, live backend, Go and PostgreSQL acceptance are not claimed; a newly required browser gate keeps the PR Draft.
