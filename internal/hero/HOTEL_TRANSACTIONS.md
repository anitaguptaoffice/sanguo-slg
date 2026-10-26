# Hotel transaction prerequisites (not activated)

`hotel_tx.go` participates only in the supplied `pgx.Tx`. The coordinator owns
actor validation, wallet then city ownership serialization, persisted building
reads, item/gold debits, commit, cancellation-safe rollback and post-commit work.
Use the approved `spec/rules/hotel_transactions.md` lock order. A locked empty
candidate query or absent schedule is **not** a city mutex.

`ListCandidatesInTx` locks candidate IDs ascending and returns oldest first.
Snapshots include authoritative server/city scope. Replacement accepts only
positive reserved IDs of the same scope. Reserve new IDs with
`NextCandidateIDInTx`; failed/rolled-back reservations may leave gaps. An exact
consume returns `ErrHotelCandidateMissing` on zero rows; it never fills or ticks.
Reuse `PGStore.ListPlayerHeroesInTx` and `CreateHeroInTx` for recruitment.

`PlanHotelSync`, `PlanHotelRefresh` and `PlanHotelRecruit` have no persistence or
asset side effects. Supply only server-authoritative transaction snapshots, never
request costs, levels, clock or randomness. Each plan captures server time once;
generation uses the existing concurrency-safe random wrapper and DATA-002 rules.
Retained candidates are copied and sorted, with positive IDs. Generated drafts
have ID zero; reserve and assign each ID only inside the caller transaction.
`Replace` and `SaveTick` are separate decisions: same/earlier-block hole filling
does not advance tick. Refresh's `ItemDebit` is the existing item, quantity one.
Recruit's `GoldDebit` is the persisted nonnegative cost (including zero); the
hero remains ID zero until `CreateHeroInTx`. Capacity uses cross-city owned count
excluding Coming/Captive. Recruitment never syncs or expires the selection.

`HotelCandidate.ServerID` is an internal, schema-free provenance field. New tx
readers/plans populate it and reject zero or a mismatched shard; the legacy
generator and wire conversions retain their existing behavior.

No port uses its store's Pool, accesses another domain, manages transactions or
executes DDL. API wiring must privately bind the stores and transaction to the
same pool/schema and reject missing, wrong-shard or rewired dependencies before
writes. These stateless participants cannot infer the provenance of arbitrary
caller transactions or prove the caller holds its serialization locks.

Existing hotel wrappers remain unchanged so this prerequisite does not disable
gameplay. They are **not atomic** and are not a fallback for a new coordinator.
No route is activated here: compatible hotel and sibling-family replacements,
separate metadata schema approval, API wiring/verification and client unknown-
outcome handling must be reviewed/integrated as one coordinated writer set.

## Local verification (2026-10-25)

Unfiltered HERO tests passed against disposable TCP-only PostgreSQL, normally and
with `-race`; HERO `go vet`, repository `go test -short ./...` and `go build ./...`
also passed. Port tests prove supplied-tx rollback across pool/tick/hero writes,
exact concurrent consumption, one-connection/nil-Pool operation, scope isolation,
absent schedule, sequence failure/gaps and failed replacement rollback. Plan
tests compare legacy sync across boundary/empty/future/overfull cases, generation
across levels/seeds, persisted recruit values/capacity and shared RNG concurrency.
Legacy hotel tests are unchanged. These are domain prerequisite tests, **not**
proof of authorized city/wallet/item/API coordination, family atomicity, unknown-
commit recovery or production readiness; those remain separate activation gates.
