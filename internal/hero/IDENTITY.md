# Hero creation identity (local prerequisite, not a release)

## Ports

- `Store.CreateHero(ctx, h) error`: requires `h.HeroID == 0`; assigns the actual
  inserted identity and creation timestamp only on successful insertion.
- `PGStore.CreateHeroInTx(ctx, tx pgx.Tx, h) error`: same insert using only the
  caller's transaction, without pool access, DDL, Begin, Commit, or Rollback.
  The caller owns the final commit decision. Use a disposable draft; its ID is
  provisional until commit. Never publish it before commit, reuse an assigned
  draft after rollback, or blindly retry an uncertain commit.
- `SaveHero`: UPDATE only by `(server_id, hero_id)`; missing rows return
  `ErrHeroNotFound`. Authorized owner, status, and attribute changes retain ID.
- There is no `MaxHeroID` allocator. PG uses the shared `player_hero_id_seq`;
  missing/exhausted/colliding allocation fails without overwriting or fallback.
- All six creation callers use the new boundary. `RecruitAndPersist` accepts
  only the memory store; durable external-state recruitment fails closed.

Creation requires zero `ForceAdd`, `IntelAdd`, and `PoliticsAdd`, as initialized
by all six creators. Nonzero values return `ErrHeroCreatePoints` before DB work.
These legacy player_hero columns have no formal migration yet; existing update
and read paths still use the pre-existing column setup helper. This card does not
solve that schema debt or introduce request-time DDL into the transaction port.
Fixtures needing allocated points must create first, then explicitly update.
Fixtures must use returned IDs, not SaveHero or a hand-computed identity to insert.

## Non-goals and gates

`RecruitPlayer` and `RecruitAndPersist` now reject every non-MemStore backend
with `ErrRecruitTransactionRequired`, before loading state or touching inventory.
Their unchanged signatures preserve API compilation, not production availability.
The API owner must wire `PlanRecruit` and `CreateHeroInTx` with wallet/content
debits in one transaction before enabling natural recruitment. There is no PG
partial-commit fallback; these memory helpers do not promise cross-domain atomicity.
The former PG success test now explicitly proves rejection without asset changes;
it is NOT atomic success evidence. Actual success/rollback/concurrency acceptance
must run through the upcoming real API coordinator, not its historical adapter.
Hotel gold/candidate deletion, coming/captive metadata, and lionize state updates
also remain separate operations; only their hero identity boundary is fixed.

Contract #1767 is the base. Approved sequence proposal #1779 is integrated locally
only; its remote merge gate and stopped-writer/rollout gates remain unmet. No
remote push, publication, deployment, migration of a production DB, or atomic
recruitment acceptance is implied by these local cards.

## Verification limits

Hero tests use explicit creation and isolated PG schemas. Identity tests cover
caller-owned rollback/commit, concurrent stores/shards, collisions/no overwrite,
nonreuse after deletion, missing/exhausted sequence, missing updates, owner
transitions, and legacy equal IDs across memory shards/auxiliary state.
`MemComingStore` and `MemCaptiveStore` also key metadata by `(server_id, hero_id)`;
accept/reject and summon/release tests preserve the other historical shard's
metadata, hero status, and item requirements.
Hotel candidate allocation now uses the separate `city_hotel_candidate_id_seq`
contract; multiple reservations before persistence, pool refresh/deletion and new
connections do not recycle IDs. Missing/exhausted sequence fails without fallback.
The original hotel PG test remains intact. Candidate identity is not hero identity.
Pool snapshot/replacement/tick, gold/candidate/hero and paid refresh still lack a
single transaction, and hotel API city-owner authorization remains a separate gate.
This allocator change does not authorize enabling hotel listing/refresh/recruit.
API fixture migration and production atomic coordinator remain separate cards.

## Transaction-bound recruitment prerequisites

`PGStore.ListPlayerHeroesInTx(ctx, tx, serverID, playerID)` returns all matching
rows ordered by identity through the supplied transaction only. The caller must
lock the wallet first. It neither acquires another connection nor performs DDL
or commits. Legacy point-add columns are read if present, otherwise zero, without
creating them. This does not supply the missing formal point-column migration.
Service random draws (recruit, hotel, largess) share a draw-only mutex; no DB or
inventory wait holds it. Configure `RNG`, catalog and clock before concurrent use;
standalone rule helpers still require caller-owned random sources.

`Service.PlanRecruit(snapshot *PlayerState, req RecruitRequest) (RecruitPlan, error)`
clones wallet/items/heroes and makes no DB/cache calls. API must supply authenticated
server/player IDs, same-transaction wallet and bag, and the tx-bound owned list.
It returns `Hero *Hero` with zero ID, `ResourceDebit Resources` (gold zero),
`ItemDebits []ItemCost` (`ItemCfgID, Quantity int32`), `WalletAfter Resources`, and
`ItemsAfter map[int32]int32`. After-fields are not authoritative persistent writes
or cache publications. The plan is disposable and creates no reservation.
Costs are nonnegative four-resource int64 values; subtraction is balance-checked
per field without sums or products. Negative/wrapped or unsupported gold costs,
nonpositive book quantities and unknown/mistyped recruit books are rejected.
Existing pool override/default, one random draw/book, DATA-002 base stats and
same-template exclusion remain; no natural-recruit capacity limit was added.

Recruit-plan verification additionally covers immutable shared snapshots under
concurrent plans/hotel/largess draws, draw-sequence preservation, malformed and
out-of-range costs, full-width exact debits, unknown inputs, transaction-local
owned rows and rollback, and no mutex held while the hotel store blocks.
These are prerequisite/domain tests, not API transaction success acceptance.
The earlier recruit-plan prerequisite run excluded the then-known
`TestRecruitHotelCandidatePG` candidate allocator failure; that historical run is
not an unfiltered pass. The later candidate allocator card separately passes the
unchanged original test and unfiltered HERO normal/race suites; it does not prove
hotel transaction or ownership safety.

Candidate allocator validation uses two independent PG pools and concurrent ID
reservations/refreshes in distinct cities; it does not claim same-city refresh
atomicity. The restart fixture is `go run ./internal/hero/testdata/candidate_id_restart`
from repo root, with explicit disposable `HOTEL_CANDIDATE_ID_TEST_DSN`, unique
`HOTEL_ID_PROBE_SCHEMA=hotel_candidate_probe_<suffix>` and `HOTEL_ID_PROBE_PHASE`
before/after an operator-owned clean PostgreSQL restart. The after phase drops its
schema. Never use this fixture against production or a schema owned by another run.
