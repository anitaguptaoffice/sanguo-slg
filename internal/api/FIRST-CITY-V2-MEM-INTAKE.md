# API-FIRST-CITY-V2-MEM-INTAKE-001 ([#2544](https://github.com/anitaguptaoffice/sanguo-slg/issues/2544))

Stacks reviewed #2542. In-memory per-actor ledger + injected template intake: real **PENDING**
retention and wire `SubmitFirstCityResponse` / Discover head. No SQL, no WORLD insert, routes still off by default.

`WireFirstCityV2Ledger(ledger, intake)` after `EnableFirstCityV2Routes`; either nil → Submit stays `COMMON_UNAVAILABLE`.

```sh
go vet ./internal/api/...
go test -count=1 ./internal/api -run FirstCityV2
```
