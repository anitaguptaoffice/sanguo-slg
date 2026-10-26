# Bounded wall achievement integration

The level provider remains a pure durable-state derivation: unchanged chain100
floor1–5 combined with exact completed verified1006 floor6, followed by scoped
GREATEST(existing_level,floor). It never calls receipt/fact recovery or recursively
checks unlocks. Higher persisted levels are never lowered; no other growth is added.

Profile/login entry and task/chain reads run receipt-first wall recovery outside
that provider before the final persisted level read. Claim remains service-owned
and receipt-first; the API repairs level after success or AlreadyCompleted without
replaying payment. Committed cfg7 completion and item-use callbacks are hints only;
wall proof always reads owned durable buildings. Failed hint recovery is diagnostic
and ordinary task/login/Claim reads repair it. Default wall_level metadata, queue
targets, client payloads and foreign cities never establish wall achievement.

Actual-PG fixtures verify current owned completed wall vs queued/foreign/default
metadata, claimable proof without premature level, one exact wood800/item2018
payment, persisted level6 response, restart after wall loss, completed legacy
no-payout verification only on explicit Claim, NULL acceptance preservation, and
receipt/completion/level-write failure recovery. Existing phase1 level tests pass.
These are synthetic integration fixtures; native construction/cost/timing acceptance
is a separate gate. Full compatible QUEST/API/client activation and old/in-flight
writer quiescence are required by spec/rules/onboarding_wall.md.

Additional PG fixtures prove old successful payment with missing quest history
repairs completed/NULL acceptance without passive floor6, explicit Claim alone
can verify that no-payout achievement, task/chain reads recover persisted floor,
and an inconsistent legacy receipt blocks new proof. Existing unlock6 gates1007,
1009,1014,1018 become accessible, but only the pre-existing daily1014 event behavior
advances; no new non-wall objectives or training-history proof are introduced.

Wall read/profile/hint and wall-only Accept/Claim perform a positive, shard-scoped
current player existence preflight before receipt/history repair. A stale bound
session for a deleted player cannot create orphan completed quest history. This
is not a transaction-wide concurrent actor-deletion guarantee; existing phase1
Claim receipt-first ordering is unchanged. Cancellation and foreign-shard actors
fail before wall history writes.

Startup wiring propagates real PostgreSQL catalog load errors, including malformed
1006 raw objectives/rewards and query failures. It never disguises such failures
as an empty development catalog. The existing explicit nil-pool or successfully
loaded empty development catalog fallback remains supported. A wiring error must
abort startup; this is not a live catalog hot-reload mechanism.

List/chain service reads may themselves recover a competing claimant's committed
receipt after the API pre-refresh. A final pure level repair therefore runs after
successful service reads and before their response. It does not recurse into new
recovery or grant; failures return the existing safe error rather than a successful
completed-proof view with a persisted level one read behind. The deterministic PG
regression commits a real competing payment at the second receipt lookup.
