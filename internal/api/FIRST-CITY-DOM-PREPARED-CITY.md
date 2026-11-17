# First-city DOM PreparedCity product card (tracking)

**Status:** default-off wired. Set `SANGUO_FIRST_CITY_USE_PREPARED_CITY=1` at server start (requires `MilitaryDurable` + DOM hub). Effect uses `createFirstCityViaPreparedCity` (Prepare / LockWallet / Stage / Publish). Legacy `createPlayerCity` remains when unwired.

| Layer | Today | PreparedCity card |
|-------|--------|-------------------|
| FCT1 / template | `FirstCityTemplateRef` + `firstCityTemplateContent()` bytes | Align with `FreshCityParticipant.CaptureTemplate` (see `TestFirstCityTemplateRefFCT1`) |
| Effect | `FirstCityCreationEffect` → `createPlayerCity` | Pin-ordered DOM participant staging in same effect txn as ledger settle |
| Proof | PG/API integration tests | Reuse `internal/domestic/fresh_prepared_city_*_test.go` + CITY_CREATION recovery §11 browser |

**Non-goals on this card:** cutover, realm enrollment, replacing legacy `world.v1.CreateCity`, or merging effect+settle into one companion txn (separate card).

**Env:** `SANGUO_FIRST_CITY_USE_PREPARED_CITY=1` → `runtime.maybeFirstCityPreparedSource` + `WireFirstCityPreparedCreation`. PG ledger settle receipt unchanged until atomicity card.

**PG smoke:** `TestFirstCitySubmitCreatesCityPreparedPG` (`DATABASE_URL`, full ApplySpecs schema).  
**Ledger atomicity (small step):** when PreparedCity is wired and PG ledger is active, `settleFirstCityEffect` uses `settleFirstCityEffectPreparedPG` so business placement and `world_first_city_command` terminal receipt commit in one `recruittx` transaction (`settleOnTx`). Legacy `createPlayerCity` + separate `Settle` unchanged.