# DOM-PRODUCTION-001: durable fractional production (proposal)

Status: separate contract for review; not an approved runtime change. Consumers:
`internal/domestic` (DOM-REPAIR-002 successor); deployment schema application.
No protocol/API shape changes. Existing art/reference holds remain untouched.

## Why a dedicated checkpoint

`player_wallet` stores integer resources; `updated_at` is shared with rewards and
spending. Five-second reads currently floor 252 food/hour into zero every time.
Keeping four fractions only in memory fixes polling but loses them on restart.
A single timestamp cannot encode four independent remainders; overloading queue
JSON or wallet timestamps would be an undocumented schema/rule change.

`007_domestic_production_checkpoint.sql` stores one row per `(server_id, city_id)`
with the owning player, a dedicated settlement instant and four fractional
numerators. Logical owner references follow existing no-cross-domain-FK policy.
Owner mismatch must fail closed rather than silently overwrite/reassign the row.
Only domestic settlement may advance this clock. External wallet writers neither
need nor receive permission to update the checkpoint.

## Arithmetic and caps (no economy change)

- Keep the existing per-building hourly formula and its flooring; sum the rates.
- For resource `r`, compute `n = remainder_r + rate_r * eligible_elapsed_ns`.
  Credit `n / 3600000000000` whole units and retain `n % 3600000000000`.
- Use overflow-safe intermediate arithmetic; never convert an out-of-range value
  to int64. Check against remaining warehouse space before final credit.
- Wallets at/above production cap retain their exact integer balance (including
  MaxInt64); their production remainder becomes zero. On reaching cap, discard
  overflow and remainder. Spending after that must not unlock banked overflow.
- Keep the current **24-hour** per-settlement offline limit. Cap elapsed duration,
  then advance checkpoint to actual `now`, so truncated offline time is not
  recovered by another read. Previously earned subunit carry is retained unless
  storage caps discard it. Clock equality/backwards reads do not mutate state.
- Settle through the existing completion instant before building/main-hall rate
  changes. Carry represents already earned resources, not time at the new rate.
  This proposal does not change delayed build-completion scheduling or add live
  catalog hot-reload semantics. A future rate-changing path must settle first.

PostgreSQL timestamps have microsecond precision, while Go clocks can use
nanoseconds. Save `settled_at = t.Truncate(time.Microsecond)` and separately
`settled_submicro_ns = t.Nanosecond() % 1000`; reconstruct by addition. This avoids
repeat-credit or lost-time drift on restart without silently quantizing accrual.
All four numerators are in `[0, 3600000000000)`; SQL checks enforce this boundary.

## Atomic load/save and migration

**Never lazily seed an existing city from mutable `player_wallet.updated_at`.**
Settling city A moves that shared timestamp and would erase city B's legacy
interval before B's first load. Initialize every existing owned city first.

1. Close and verify the rollout write gate: stop domestic writers and all writers
   of wallet timestamps, city ownership, buildings and build queues. Keep it
   closed from the initial legacy snapshot until backfill and coverage checks
   finish. Stop old domestic writers permanently before new consumer activation.
   Apply the reviewed DDL as a deployment migration, **never runtime DDL**.
2. Run `migrations/007_backfill_city_production_checkpoint.sql` under that gate.
   It locks the source tables, fails preflight on missing player/wallet, orphan
   domestic state, or existing checkpoint owner mismatch against `player_city`.
   Do not create wallets, invent balances/timestamps, or silently repair ownership.
   Any rejected data needs explicit reconciliation before retrying.
3. In one transaction, seed **all** existing owned cities from their owner's
   locked, unchanged wallet timestamp and zero remainders. The wallet itself is
   not written. `INSERT ... ON CONFLICT DO NOTHING` preserves every existing
   clock and carry; the preflight verifies their ownership. Check complete city
   coverage before commit, then verify it again before opening the write gate.
4. On failure, the whole transaction rolls back. Resuming a partial/replayed
   rollout is allowed only while the same write gate has remained continuously
   closed, so its source timestamps remain unchanged. If it opened, **do not**
   seed missing rows from later wallet timestamps. Stop and reconcile against a
   retained immutable pre-activation seed, if one exists. This proposal does not
   provision such a seed or authorize reconstructing it from current wallets.
5. After activation, an existing city missing its checkpoint must fail closed;
   no fallback/lazy repair. A genuinely **new city** is a separate explicit
   creation/registration operation: seed its checkpoint from that operation's
   `now` (with full sub-microsecond precision), even if its player's wallet is
   old. Never backdate it from wallet.updated_at. Coordinate city registration
   and checkpoint initialization before making the city eligible to settle.
6. Runtime operations lock `player_wallet` first, then the city checkpoint. Load
   wallet, checkpoint, buildings and queue consistently in that transaction.
   Reconcile authoritative wallet as before, settle using the checkpoint, then
   write wallet, checkpoint, buildings and queue atomically. Publish the cloned
   city and baseline only after commit; SQL/callback failure rolls back fractions
   and clock. Missing migration/checkpoint or owner mismatch must surface as an
   error, not a successful in-memory-only registration.
7. Existing single-Hub ownership of a city's buildings/queue remains required;
   this is not multi-writer fencing. Mixed old/new domestic writers are unsafe.
   Rollback to the old binary requires explicit reconciliation; additive DDL
   alone does not make runtime rollback safe. Previously discarded fractions or
   time hidden before migration cannot be recovered; no guessed compensation.

Executable contract checks (isolated schema, PostgreSQL required):
`DATABASE_URL=... bash spec/db/tests/production_checkpoint_backfill.sh`.
This tests SQL migration semantics, **not** operational write-gate enforcement or
runtime consumer durability. Operators must establish the gate independently.

## Required consumer acceptance (before integration/release)

- One hour once equals 720 five-second polls and irregular sub-second partitions
  for all four distinct rates, multiple producers and production deltas.
- Same/backwards timestamp reads; zero rates; initial registration; warehouses
  below/at/above cap; cap-then-spend; MaxInt64 wallet and extreme rate arithmetic.
- Rate/main-hall changes settle old production, retain fractions and apply new
  rates only forward; retain current completion scheduling behavior.
- Single 48-hour absence gives only 24-hour credit; repeating the read gives none.
- Real PG: reload at a non-integral balance, then continue and compare with no
  restart; repeat over sub-microsecond checkpoint boundaries. New pools/Hub
  instances, not copying an in-memory CityState, must establish persistence.
- External rewards/spends update wallet.updated_at without moving the checkpoint;
  later settlement includes all eligible production without losing/doubling gifts.
- Inject SQL failure after wallet/checkpoint writes; prove DB and cache rollback;
  retry once and show no lost/duplicated whole units or fractional numerators.
- Two existing cities sharing a wallet both receive the same immutable legacy
  seed before either settles; settling A must not move B's clock. Partial/replay
  backfill preserves existing clock/carry and seeds remaining cities only from
  the continuously gated original wallet snapshot.
- Missing wallet/player, orphan building/queue/checkpoint, owner mismatch and
  incomplete initialization fail closed without partial inserts. New-city seed
  uses explicit creation `now`, not an old wallet timestamp. Runtime activation
  remains blocked after any failed preflight or interrupted gate continuity.
- Invalid SQL remainder rejection, absent migration/checkpoint failure and
  incompatible mixed-writer rollout guard.
