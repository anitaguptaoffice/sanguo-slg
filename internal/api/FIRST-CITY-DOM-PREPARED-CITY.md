# First-city DOM PreparedCity product card (tracking)

**Status:** partial. Live first-city effect uses `createPlayerCity` → `Hub.CreateNewCity` atomic path, not the full `FreshCityParticipant` → `PreparedCity` (Prepare / LockWallet / Stage / Publish / Close) chain from [CITY_CREATION_RECOVERY](../../spec/rules/CITY_CREATION_RECOVERY.md) §10 item 5.

| Layer | Today | PreparedCity card |
|-------|--------|-------------------|
| FCT1 / template | `FirstCityTemplateRef` + `firstCityTemplateContent()` bytes | Align with `FreshCityParticipant.CaptureTemplate` (see `TestFirstCityTemplateRefFCT1`) |
| Effect | `FirstCityCreationEffect` → `createPlayerCity` | Pin-ordered DOM participant staging in same effect txn as ledger settle |
| Proof | PG/API integration tests | Reuse `internal/domestic/fresh_prepared_city_*_test.go` + CITY_CREATION recovery §11 browser |

**Non-goals on this card:** cutover, realm enrollment, replacing legacy `world.v1.CreateCity`, or merging effect+settle into one companion txn (separate card).

**Next implementation slice:** wire `MilitaryDurable.FreshCity()` into first-city effect behind default-off flag; stage through `PreparedCity` with existing starter `firstCityInitialState`, then keep PG ledger settle receipt unchanged until atomicity card lands.