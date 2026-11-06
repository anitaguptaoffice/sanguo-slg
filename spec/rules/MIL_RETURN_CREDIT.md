# SPEC-RETURN-CREDIT-001 — durable return credit

Task [#2093](https://github.com/anitaguptaoffice/sanguo-slg/issues/2093).
Status: **proposal for independent review, not implemented or activated**.
Base: `aa6afe52d8372a396c45c82df3386da94097a80f`.
This rules-only proposal selects the missing return-specific boundary for #1953.
It adds no Go, wire route, schema, receipt table, migration or runtime flag.
Approval of prose is not source enrollment, test execution or rollout permission.

Inputs: [command boundary](SLG_COMMAND_BOUNDARY.md),
[march persistence](MARCH_PERSISTENCE.md), [fresh cohort](MIL_FRESH_COHORT.md),
[recruit queue](MIL_RECRUIT_QUEUE.md), [recruit ports](MIL_RECRUIT_PORTS.md),
[transaction lifetime](MIL_RECRUIT_TX_LIFETIME.md).
Their source, retention, generation-lease and incompatible-writer fences remain.
Historical reference/art/VERIFY holds and current unaccepted components remain held.

## 1. Scope and durable identity

The operation completes one already accepted, due returning march; it is not a
new user request, recall, transfer, march creation, battle replay or troop refund.
Its stable identity is `(server_id, march_id, army_id, origin_city_id, owner_player_id)`
from retained `march_order` joined to `field_army`, never a new generated key.
An unlocked discovery row is only a candidate. Every attempt revalidates that exact
identity under the locks below. Missing/mismatched records are unavailable, not done.
IDs are positive JavaScript-safe integers; captured shard must match every row.
No coordinate, clock, report count, Hub phase or payload hash substitutes for identity.

Only certified fresh-cohort cities are eligible. Validate the immutable marker's
owner/cohort/format1 against the reviewed source and current WORLD owner. The army
owner is immutable; city transfer, adoption, reused identity and legacy backfill are
unsupported. A marker alone cannot certify an old march or a historical credit.
Enrollment must establish that every eligible march was created/debited by the
reviewed durable chain and that no older volatile-return writer produced its terminal
history. Otherwise the cohort remains unavailable; never repair it from current stock.

Retain order, army, survivor stacks, accepted origin identity and return deadline
throughout replay support. Do not delete troops after credit: their retained values
are transition evidence, not extra ready stock. No ID reuse or history truncation.
No receipt table is added: the atomic terminal row plus its validated retained graph
serves as transition evidence ONLY within that continuously certified writer cohort.
This does not prove correctness after arbitrary SQL, evidence loss or incoherent restore.

## 2. Source binding and ownership

APP owns one immutable concrete pool binding, a complete same-generation participant
set, its admission lease, one Begin/end pair and outcome classification. Reuse the
exact-access lifetime mechanism of MIL_RECRUIT_TX_LIFETIME; extending its use to this
return command does not turn it into a generic coordinator or authorize raw pgx ports.
Domain participants receive only that transaction's bound live Access, never Owner,
Pool, Conn, raw Tx, Begin callback, iterator or caller-supplied success proof.
No participant commits, rolls back, creates savepoints, changes roles or publishes Hub
state. Any participant error requires APP rollback; no partial result may be committed.

Profiles must be independently approved expectations, not discovered replacements.
Capture database/schema/current and session role, source evidence, cohort and exact
relation/index OIDs, owners, shapes and privileges. Pin first and revalidate before
business SQL. Preserve the existing no-shadow/RLS/trigger/rule/inheritance/default
checks; reject unknown objects/shapes and retire the generation on definite drift.
Schema-qualify business SQL and resolve catalog operators/functions through pg_catalog.

The MIL return inventory is the existing 14-object Recruit inventory plus exactly:
`march_order`, `march_order_pkey`, `idx_march_arrive`, `idx_march_return`, `field_army`,
`field_army_pkey`, `idx_field_army_owner`, `army_troop`, `army_troop_pkey`.
Validate their reviewed 004_military + m4_009 shapes, identity/ownership and needed
SELECT/UPDATE privileges; no allocation, sequence reset, DDL or metadata repair.
The 23-object return profile is not passed to existing 14-object constructors.
Any private projection/reuse must preserve identical approved common identities,
binding and retirement/lease semantics; matching DSNs do not establish provenance.
ACCOUNT/DOM/WORLD retain their own exact inventories and shared-generation agreement.
A concrete catalog checker/participant requires its own reviewed implementation card.

## 3. Complete serialization order

One attempt handles one city and one march. No multi-city batching or early lock release.
Before Begin, acquire the APP generation lease. Hold it through transaction end and
outcome handling; retiring a source must drain/fence all outstanding attempts, including
unknown outcomes, rather than reopen legacy writes. DOM settlement, if needed, finishes
before Begin. Return itself neither charges nor changes the wallet.

Acquire ALL relation pins in this order, before any row lock, with no later upgrades:
1. ACCOUNT `account`, then `player`: ROW SHARE.
2. DOM `player_wallet`: ROW EXCLUSIVE.
3. WORLD `player_city`: ROW SHARE.
4. MIL `mil_city_origin`, `city_troop`, `work_queue`, `mil_recruit_origin`,
   `mil_recruit_receipt`: ROW EXCLUSIVE, preserving Recruit order.
5. MIL `march_order`, `field_army`, `army_troop`: ROW EXCLUSIVE.
Indexes are checked with their owning relations; these pins are not an external DDL,
sequence, retention or restore fence. Those exclusions remain APP/enrollment duties.

Then acquire row locks in this order and retain them through transaction end:
1. Authoritative account FOR SHARE, then its exact shard/player FOR SHARE; require
   active account and current association. Scheduler discovery of account identity is
   untrusted until these locks validate it; a daemon is not an authorization bypass.
2. Existing player wallet FOR UPDATE; validate source and legal balance, debit nothing.
3. Exact WORLD city FOR UPDATE, requiring the candidate owner; capture origin x/y.
4. Immutable city marker FOR UPDATE, then ALL city stock rows in unit order FOR UPDATE.
5. ALL pending type3 queue rows for that city in queue-ID order FOR UPDATE; do not filter
   wrong owners or malformed payloads out. Origin/receipt/rule evidence is read after
   these locks under existing immutable-retention fences, without reverse row upgrades.
6. Exact march row FOR UPDATE, then its army FOR UPDATE, then ALL its troop rows in
   unit order FOR UPDATE. Recheck candidate identity and relationships, not cached joins.

If a candidate is stale, rollback/no-op only after authoritative classification. No
march-row lock before the WORLD barrier, even for duplicate/readback paths. Preserve
that barrier through every stock and terminal write. Source/read errors fail closed.
Arrival does not acquire stock/city locks; its march lock can precede its report work,
but cannot call into this command while holding that lock. Compatible stock/debit,
recruit, GM and maintenance writers must obey the common earlier ordering and city
barrier. No inverse order is permitted merely because one writer is normally disabled.

Never acquire a Hub/cache mutex while PG locks are held, or hold a Hub mutex while
waiting for PG. Snapshot an in-memory candidate briefly, release the mutex, execute
through APP, and reacquire only after transaction end for guarded publication.
This requires a separate Hub boundary change; inserting SQL in today's locked
`onMarchReturn` is forbidden. No callback may recursively enter another coordinator.

## 4. Legal state, capacity and atomic writes

Read every stock row: exactly units1–4, unique, nonnegative int32 ready and wounded.
Missing/extra/malformed rows are unavailable; no INSERT/UPSERT/zero initialization.
Preserve legal wounded values unchanged. Wounded does not reserve ready capacity;
unsupported wounded-return inputs are rejected, not converted into ready troops.

For an eligible status3 return, validate the complete pending Recruit set, its FIFO,
owner, origin/receipt links, stored accepted rules and payloads as MIL_RECRUIT_QUEUE
requires. Do not call admission Prepare as a validator: it plans a new admission and
may allocate an ID. Use shared read-only validation of existing accepted work instead.
For every unit, let R be ready stock, P the sum of ALL accepted pending recruit counts,
and S the locked persistent returning survivors. Require nonnegative checked sums:
`R + P <= MaxInt32` before this command and `R + P + S <= MaxInt32` after it.
Check all units before any write. Example R=MaxInt32-2, P=2, S=1 is unavailable even
though R+S alone fits. Reject/defer the whole return without changing troops or due;
do not truncate survivors, cancel recruitment, refund or invent a new waiting list.
Unrelated accepted pending work must still be able to complete without overflow.

Status3 must have a valid retained return deadline after arrival, army status2 at
the recorded destination, known unique positive survivor stacks and matching
origin/owner. Retained hero IDs must be nonempty, unique and positive; this participant
does not query or change player_hero. HERO authorization/release has its own later
reviewed boundary, not an undeclared lock rank in this transaction.
Use persisted survivors, never callback/request counts or recomputed combat. Sample the
bounded command clock in PG after locks; an early deadline produces no writes. Clock
reversal does not authorize early completion. No troop stack means malformed status3.

In ONE transaction, conditionally apply all of:
- `city_troop.count = R + S`, preserving wounded and every untouched row.
- `march_order.status = 4`, retaining original identity and return deadline.
- `field_army.status = 1`, position = the locked original WORLD city's coordinates.
Retain army ownership, hero IDs and survivor rows; require original march from_x/from_y
match that city, otherwise fail closed. Every expected-row-count mismatch or SQL error
aborts the whole transaction. There is no separately committed claim bit or cache credit.
Read back actual affected values within the same transaction before APP may commit.
No update to wallet, hero, battle report, quest, recruit receipt or queue status.

## 5. Terminal evidence and replay

Readback is an internal recovery operation, not a new public historical-result route.
Use the same bound source, actor/city authorization, retained cohort and lock order.
A terminal candidate must match the full immutable identity and reviewed lifecycle:
- A credited return has status4, army status1 at original city, a retained valid return
  deadline and nonempty legal survivor stacks. In the certified chain this terminal
  transition and its stock addition are inseparable. Never add these stacks again.
- Annihilation at arrival is already status4, army status1 at the destination, no
  survivors and no return deadline. It is terminal without a stock credit; do not
  fabricate a status3 zero-stack return or claim that its zero stock was credited.
Unknown/mixed terminal shapes, lost rows, a legacy terminal writer or broken provenance
are unavailable. Missing history is not rejection and current R is not proof of credit.
Terminal classification does not re-run current admission/capacity rules to invalidate
an established historical transition. Any independently returned current stock is a
fresh snapshot, never the historical before/after balance or authorization to add S.
No public replay contract across ownership transfer is introduced here.

The guarantee is at most one committed stock addition per certified retained return
identity; a confirmed eligible execution atomically adds once and terminates. It is
not universal exactly-once delivery, repair of old losses, or multi-restorer safety.
No physical restore that rolls back/deletes terminal history while preserving or
replaying stock is certified; coherent restore and external writer fencing are gates.

## 6. Commit outcome and unknown recovery

Participant success is PROVISIONAL until APP confirms the sole outer Commit. After
confirmed commit, cache failure cannot reverse success. On confirmed pre-commit failure
or server rollback, all durable effects remain absent; retry uses the SAME identity
and repeats complete validation, never a newly allocated march or replacement job.

If Commit was invoked and its outcome is uncertain, publish neither returned nor a
stock delta; do not release heroes, compensate, refund, or blindly resubmit. End the
old access capability, perform bounded cleanup, retain the scoped unresolved identity
and report unknown. Cleanup errors, rollback attempts and timeouts prove no outcome.

Readback uses a fresh bound transaction and the SAME serialization barriers. The old
write transaction necessarily acquired the WORLD city barrier before reaching Commit;
a new reader must acquire that barrier and the march lock before classifying it. This
waits for conflicting in-flight writes to resolve, not an arbitrary sleep. If locking,
source provenance, owner validation or identity evidence cannot be established, remain
unknown/unavailable. Missing rows or transient connection failures do not permit retry.
- Valid credited terminal / annihilation: return that disposition, credit nothing.
- Same complete valid status3 after the prior transaction is known resolved under the
  barriers: no prior return commit; end readback and allow a separately bounded attempt
  of the same identity, rechecking due/capacity/source. Readback itself writes no effects.
- Any other state or drift: quarantine for explicit reconciliation, not guessed repair.
Keep unresolved work discoverable across process loss via persisted status3/due scanning
and certified terminal history; memory-only retry lists are not the authority.

## 7. Dormant ports, publication and integration gates

Freeze these semantic roles; exact exported Go declarations are a separate PORTS-only
SPEC prerequisite before production implementation, not left for a writer to improvise:
- Bound Return participant: Pin; inspect/lock/validate candidate; apply provisional
  due return or classify early/terminal; no transaction ownership or cache access.
- Bound readback: same scoped identity and barriers, no business writes; dispositions
  credited-terminal, annihilated-terminal, still-returning, early or unavailable.
- APP coordinator: fixed source/participants, lease, bounded Begin/end, actual account,
  wallet and WORLD locks, outcome classification and persisted-state recovery.
Results carry copied identity, disposition, retained due and separately labeled current
stock if requested. They are not transferable commit capabilities. No caller supplies
survivors, a trusted-ready boolean, arbitrary transaction or successful callback.

Hub integration is a separate MIL card on the reviewed #1980 combination. After a
confirmed outcome, invalidate/reload authoritative stock or use a reviewed generation-
ordered snapshot publication; never add historical S to a mutable cache. Late results
must not overwrite a newer city/session/Hub generation. Unknown/error preserves a
recoverable state and visible error, with no volatile-credit fallback or auto-finish.
Hero release is separate HERO/APP work after durable terminal confirmation, scoped to
all retained linked heroes; failures remain retryable/reconciled, never swallowed.

Split follow-ups: exact PORTS specification; MIL source/transaction/PG evidence;
MIL Hub scheduling/publication; APP composition/scanner/readback; API stock hydration;
HERO release recovery; final joint activation/compatibility audit. Each remains single-
domain, <=400 lines and independently reviewed. Keep #1953 blocked until its precise
component scope and prerequisites are updated. No component alone enables production.
No incompatible legacy Recruit/StartMarch/return/stock writer may serve the cohort;
complete durable creation, debit, arrival, return, hydration and restart chain is needed.
The existing single-restorer limitation remains until a separate APP lease contract
supports multiple restorers. None of these cards may release historical holds by rename.

## 8. Required implementation evidence (not evidence from this document)

Use owned disposable PG17, real independent connections, ordinary and race execution,
exact-source review, all required CI and a clean post-merge main run. Required cases:
- Normal due credit/terminal, early/clock reversal, concurrent duplicate attempts and
  duplicate terminal readback; one committed addition and retained identity unchanged.
- Four-row validation, positive wounded preserved, malformed/extra/missing stock,
  unknown/duplicate units, wrong shard/owner/cohort, moved origin and source drift.
- Capacity at/beyond int32 bounds including R+S fits but R+P+S does not; concurrent
  Recruit admission/completion/return under the common city barrier and pin order.
- Real SQL and deferred outer-COMMIT failure after credit: independent observer sees
  neither credit nor terminal. Participant error ignored by a caller must not be a
  supported production path; verify the closed APP call graph and cleanup discipline.
- Confirmed commit followed by process death before cache/response; new process sees
  terminal, performs no second addition and hydrates actual stock. Kill before commit
  at a controlled test barrier; restart permits one addition after rollback resolution.
- Simulated lost commit acknowledgement after actual server commit, and a separately
  verified not-committed case; preserve unknown until serialized readback, with no
  speculative hero release, compensation or blind replay. A deferred trigger rollback
  alone does not prove this network-uncertainty behavior.
- Terminal annihilation vs malformed zero-stack returning; deleted/mixed history and
  uncertified old terminal rows fail closed rather than reconstruct credits.
- Cancellation, lease retirement, blocked locks, runtime recovery/scanner cursor and
  repeated shutdown/start; no Hub mutex/PG inversion or forgotten due work.
Record counts, zero unexpected skips, process IDs, exact commit barriers, committed row
snapshots, cleanup and limits. Physical PG restart/coherent-backup recovery require
separate explicit evidence; ordinary Hub reconstruction is not a process restart.
