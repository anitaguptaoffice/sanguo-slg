# Wall 1006 persistence

Only exact 1006 permits proof v2. A locked accepted noncompleted row is required
for normal proof; completed history is consumed and immutable, including NULL
acceptance. The separate package-private legacy transition is reserved for
explicit Claim verification. Generic UPSERT cannot create its no-payout marker.
Both stores preserve proof/count1 and timestamps against stale writers; PG locks
also serialize first inserts. Activation requires fully quiesced old quest-writing instances AND drained
in-flight claims, grants and asynchronous continuations. Concurrent legacy imports
are unsupported. Only the reviewed compatible group may activate; these cards
are not runtime approval. Rollback must remain v2-aware or disable affected writes.

`CompletedWallLevel` is pure: exact config + completed valid v2 => 6, otherwise
1 (or an explicit error). It never reads facts/receipts or calls the unlock
provider. The API combines this with unchanged phase-1 floor and persists a
monotonic maximum; receipt/completion alone cannot bootstrap the unlock gate.

`RecoverWall` is receipt-first for every normal proof producer (post-Accept,
chain/list, building hints, login via API). Payment recovery commits/rereads
history before any further action; passive paths never create no-payout proof.
The existing facts adapter supplies completed cfg7 levels, not queue/cache data.
Unpaid accepted proof0 may verify; missing acceptance errors and unmet gates/facts
never invent proof. Safe wall views hide unverified noncompleted legacy counts.

Wall Claim uses the same coordinator, then requires durable claimable normal v2
and independently established level5 before the unchanged fixed-key grant.
Existing completed rows never grant; only explicit Claim may verify a current
wall into the dedicated no-payout variant while retaining all historical times.
Paid receipt recovery returns AlreadyCompleted; API must repair level on that
result. Completion-write failure is repaired from receipt without another grant;
level-write failure is repaired separately from pure completed proof.

Deterministic PG lock tests wait on the isolated writer's actual backend lock:
receipt-completed proof0 beats normal proof, receipt-created NULL tombstone beats
stale Accept, new proof/completion beats stale proof, and no-payout proof beats
stale Accept. Malformed persisted JSON cannot be read, listed, or overwritten.

Real CONTENT/PG fixture tests cover grant-then-quest-save failure, fresh-service
receipt-only recovery after wall loss, exact payment with missing quest row,
explicit no-payout verification retaining timestamps, wrong owner/package/status,
and concurrent claims/reads/stale writes with same-number actors on two servers.
These injected fixtures are not native gameplay acceptance.

Before creating a *new* explicit no-payout proof, Claim also checks any existing
receipt: absence is allowed, mismatch/read failure is explicit and prevents new
floor. Already durable v2 never needs this historical-payment revalidation.

Coordinator PG barriers additionally pause after an absent receipt snapshot
while a new proof-first claimant completes, and pause facts while injected old
payment recovery commits proof0. Committed rereads/locked merging preserve the
new proof in the first case and prevent normal proof/floor in the second.

Canonical PG collateral-gate regression proves persisted wall proof opens existing
1007/1009/1014/1018 level6 gates but creates no new main/side objective progress.
Existing daily1014 training, claim and next-day reset remain unchanged.

Mem/PG storage fault injection covers initial read, normal proof write, receipt
history write, explicit legacy proof write, read-after-proof, read-after-completion,
and failed grant. Durable completion survives response loss without duplicate
payout; no pre-completion failure creates floor. Both action-before-Accept and
action-after-Accept are supported without passive enrollment.

The PG catalog decoder rejects unknown raw objective JSON members for1006 only,
so deserialization cannot silently erase a mutated identity before service checks.
Other quest-objective parsing policies remain unchanged.
