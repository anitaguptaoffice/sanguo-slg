# March request and current-army read boundary

The gateway normalizes requested troop stacks with the MIL-owned checked helper
before settling production or claiming a hero. Unknown units, invalid counts and
duplicate-sum overflow therefore cannot spend hero force or publish an army.
Duplicates preserve first-appearance order and count every requested soldier.
MIL still rechecks cumulative availability under its own lock before deduction.
This is not a reservation or a cross-domain atomic dispatch guarantee: a later
stock/coordinate/store failure can still interact with the legacy hero claim.
Durable admission/army/hero transactions remain separate work.

ListMarches retains existing actor/shard/city filtering, pagination and ownership
index, but gets the order and CURRENT runtime troop composition together under
one MIL lock. A returning army reports survivors, not the stored departure copy.
Zero-survivor/no-battle/pending phases keep existing MIL semantics; no battle
rules, costs, timings, protocol fields or persistence behavior change.

Tests exercise real gateway packet decoding, malformed-input rejection before
hero/force effects, checked duplicate ordering/copy isolation, and consistent
outbound200/return166/zero/no-battle/home snapshots with unchanged return ETA.
The arrival callback is an isolated fixture, not a new native battle claim.

Reviewed returned-home contract: explicit `PhaseReturned` maps to wire5 only after
MIL settles survivors at home. History keeps identity, route, purpose, timestamps
and current survivor composition; `return_finish_at_ms` is zero outside returning.
Pending stays pending even with old timestamps; unknown domain phases map to
unspecified, never to pending or returned. List totals still include retained
history and are computed before the unchanged city/actor-filtered pagination.

The returned-history tests exercise the actual gateway and MIL completion path,
including PostgreSQL ownership, shard denials, pagination and repeat tick/read
idempotence. The successful hero fixture now supplies a battle outcome and checks
busy while returning, then idle after survivor settlement. These bounded synthetic
clock tests are engineering evidence, not natural same-process acceptance. They
neither add durability nor repair existing ignored hero-release errors; returned5
is not an atomic/durable hero-idle promise. Server emission requires the coordinated
MIL/API/client review and rollout gate in `spec/proto/MARCH-RETURNED.md`.
