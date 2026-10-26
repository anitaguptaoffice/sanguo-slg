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
