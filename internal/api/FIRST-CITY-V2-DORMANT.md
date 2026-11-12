# Dormant First-City V2 API routes

Card **API-FIRST-CITY-V2-DORMANT-DISCOVER-001** ([#2541](https://github.com/anitaguptaoffice/sanguo-slg/issues/2541)).
Adopts frozen **SPEC-CITY-CREATION-WIRE-001** (`spec/proto/sanguo/world/v2/first_city.proto`,
#2442) and private C1 **API-FIRST-CITY-CANONICAL-001** (#2481).

## What ships

- API mirror proto under `internal/api/proto/sanguo/world/v2/` with API `go_package`.
- Complete generated binding `internal/api/pb/sanguo/world/v2/first_city.pb.go` (protoc 3.21.12,
  protoc-gen-go 1.36.5).
- Dormant gateway handlers for `world.v2.DiscoverFirstCityIntent` and `world.v2.SubmitFirstCity`.
- `Server.EnableFirstCityV2Routes(realmResolver)` registers handlers; **default `NewServer` does not call this**.

## Runtime behaviour (fail-closed)

| Route | Without enable | Enabled, no realm | Enabled + realm |
|-------|----------------|-------------------|-----------------|
| Discover | unknown route | `COMMON_UNAVAILABLE` | scope + empty `FirstCityHead` |
| Submit | unknown route | `COMMON_UNAVAILABLE` | validates scope + C1, then `COMMON_UNAVAILABLE` (no ledger/intake) |

Realm resolution is injected only through `FirstCityV2Realm`; there is no production enrollment wire yet.

## Verification

```sh
go test -count=1 ./internal/api/pb/sanguo/world/v2
go test -count=1 ./internal/api -run 'FirstCityV2|FirstCityCanonical'
```

## Limits

Generated `first_city.pb.go` is excluded from the ≤400 hand-written line budget (same pattern as recruit V2 bindings).
This card does not activate transport, write PostgreSQL, or call domestic/world creation paths.
