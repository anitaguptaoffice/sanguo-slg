# SPEC-HOTEL-CANDIDATE-ID — candidate identity proposal

Local review candidate based on HERO identity `0a55d89`; not activation approval.
Scope: `spec/db/**`. No consumer, runtime DDL, GRANT, credentials, production migration or deploy.
No hero identity, costs, attributes, pools, SKU/IAP, DATA-002 or existing IDs change.

## Identity and audited references

`city_hotel_candidate_id_seq` is separate from `player_hero_id_seq`: permanent/logged,
BIGINT, START/MINVALUE 1, MAXVALUE 9223372036854775807, INCREMENT/CACHE 1, NO CYCLE,
OWNED BY NONE. All servers/cities in one application schema/database share it, not other databases.
Keep `(server_id,city_id,candidate_id)` PK and existing cross-city/shard duplicate IDs unchanged.
Candidate identity is not hero identity; recruitment still allocates a new hero ID.
Future `NextCandidateID` uses nextval, never MAX+1, batch counters or fallback; missing,
exhausted, unavailable or unauthorized sequence fails closed. Gaps/rollback reservations are normal.
An ID is not ownership evidence; never infer a server/city/player from its value.

Source inventory: `m4_004_hotel_recruit.sql` and `internal/hero/hotel*.go` persist candidate IDs
only in `city_hotel_recruit.candidate_id`. Schedule contains city/tick, no candidate identity;
hero and API/proto values do not introduce another stored candidate reference.
The migration scans all cities/shards in that required BIGINT column, not guessed hero tables.
Unknown candidate_id/candidate_ids relation-column pairs fail closed pending reviewed inventory;
audit opaque/import/export/external references separately. Missing/wrong-shaped source fails.

## Maintenance, replay and restore gates

1. Before any ApplySpecs-capable boot, release owner stops and drains all old candidate writers,
   list-triggered sync, paid/unpaid refresh, recruit/delete, sequence clients, maintenance and DDL.
   Table locks serialize migration reruns but cannot prove drain or prevent later old MAX writers.
2. Use one owner, READ COMMITTED, exact application schema first in search_path. Objects are
   schema-qualified: no adopting a sequence/table from a later schema. RLS cannot hide source rows.
3. Audit surviving rows and known reserved/deleted/exported/restored ID highwaters. Supply greatest
   known reservation via `sanguo.hotel_candidate_id_reserved_highwater` on EVERY migration pool
   connection. Nonnegative BIGINT; default 0 only when none known. Unrecorded deleted IDs cannot
   be proven unreused. No inferred history from current MAX alone.
4. Verify existing owner SELECT/lock/CREATE/sequence UPDATE permissions and application USAGE
   under approved role policy; this SQL grants nothing. Wrong existing objects/configs fail,
   never repair/reset silently. Verify application schema/routing; isolated tests do not prove these.
5. `m4_006_hotel_candidate_id_sequence.sql` follows m4_005 in lexical ApplySpecs order. Its one DO
   transaction advances strictly above H=max(rows, known reservation), preserving higher state.
   Empty first ID=1; H=MAX aborts; H=MAX-1 allows MAX once then errors, never wraps.
6. ApplySpecs records its ledger separately: SQL-success/ledger-failure replay retains object and
   highwater. setval is last and only forward; rollback may retain advancement (intentional gap).
   Never DROP/recreate, RESTART, lower setval or restore a lower sequence snapshot to roll back.
7. Restore data/sequence together, preserve external highwater, then rerun this forward-only audit
   with writers drained even if ledger says applied. A stale restored ledger is not an audit.
8. Independently review/integrate contract, then implement the separate HERO consumer card.
   Before activation verify ledger/config/highwater, application-role nextval probe (gap), compatible
   writers, actual unfiltered HERO PG suite and remaining safety gates below. No mixed old/new writers.

## Boundaries not fixed by this sequence (source inspection, not runtime proof)

`SyncHotelPool` reads candidates/tick before `ReplaceCandidates`; replacement alone wraps its
DELETE+INSERT, while tick update is separate. Concurrent empty fills can overfill; stale sync can
overwrite fresh pools or resurrect a recruited candidate; tick failure can repeat eviction.
`RecruitHotelCandidate`: capacity check, SpendGold, CreateHero and DeleteCandidate are separate;
delete ignores affected count. Concurrent recruit can duplicate a candidate/overrun capacity;
failure can retain debit without hero or retain hero/candidate after debit.
`RefreshHotelPoolPaid` spends item before replacement/tick; a later failure can consume the item.
API hotel handlers verify player/shard but not requested city ownership; building lookup checks
server/city only. List also mutates. These are existing-feature safety blockers, not new gameplay.

Minimal follow-on cards (each independently scoped/reviewed, split at 400 changed lines):
- HERO candidate consumer + real PG batch/multi-instance/deletion/restart uniqueness tests.
- Separate hotel transaction contract: common city serialization, wallet→item lock compatibility,
  capacity serialization with other creators, owner recheck, failure/unknown-commit behavior.
- HERO tx-bound candidate/tick read/replace/consume ports and pure rule planning; no foreign SQL.
- API production coordinator: city ownership; one transaction for refresh+tick(+paid item), and
  gold+capacity+candidate consume+hero insert; use owned domain ports, no legacy fallback.
- Real production-adapter PG concurrency/failure tests before enabling any hotel write route.
Sequence uniqueness alone is insufficient authorization to enable hotel listing/refresh/recruit.

## Isolated validation

`HOTEL_CANDIDATE_ID_TEST_DSN=<disposable DSN> python3 spec/db/tests/hotel_candidate_id.py`
and `go run ./spec/db/tests/hotel_candidate_loader` (same environment) exercise actual SQL
and ApplySpecs replay. Tests own/drop unique schemas; no role/GRANT/credential mutation.
Results belong in local evidence; no assertion of production drain, permissions, restore history,
runtime consumer safety or PostgreSQL versions not actually run.
Local PostgreSQL 17.6: migration fixtures, actual loader replay, clean restart and validate.sh pass;
hero migration fixture regression passes. Unchanged TestRecruitHotelCandidatePG still fails at
duplicate candidate PK before hero creation. No consumer fix or unfiltered HERO suite pass claimed.
