# Recruit business ports and fixed coordinator

Task: [SPEC-RECRUIT-PORTS-001 / #1898](https://github.com/anitaguptaoffice/sanguo-slg/issues/1898), base `dcd1f01c212ac2dd42b5c1aab14c87e2d520a6c4`.
Inputs: [command](MIL_RECRUIT_COMMAND.md), [queue](MIL_RECRUIT_QUEUE.md),
[storage](MIL_RECRUIT_STORAGE.md), [lifetime](MIL_RECRUIT_TX_LIFETIME.md),
[rule evidence](MIL_RECRUIT_RULE_EVIDENCE.md), [fresh participants](FRESH_CITY_PARTICIPANTS.md).
This selects future Go business ports and the sole production call graph. It does
not implement or activate them, amend DDL/proto, certify an epoch, or report a
runtime or crash test. The inputs remain binding; this is not a new generic UoW.

## 1. Dependency and construction

APP is `internal/api`; domains are `internal/account`, `internal/domestic`,
`internal/world`, `internal/military/march` (MIL). Domain packages depend on
`internal/platform/recruittx` and `freshsource`, not APP or one another for these
ports. In particular DOM does not import MIL plans and MIL does not import DOM
wallet proofs. APP copies four named cost fields between value types and checks
exact equality; no conversion by positional struct literal. Domain values and
opaque handles are not authorization or evidence of commit. Closed, reviewed APP
composition, not an arbitrary success callback or a caller-supplied boolean,
enforces debit-before-insert and commit-before-publication.

At startup APP uses one exact `*recruittx.Binding`, an independent reviewed
`freshsource.Profile` and separately retained external enrollment evidence per
fresh participants §1–2. It loads the reviewed retained MIL catalog artifacts and
explicit current version under rule-evidence rules; request/job bytes cannot supply
catalog authority. No discovery-as-approval, mutable profile or new per-request
pool/catalog/source. With an APP-owned bounded validation transaction, construct
these concrete participants (ctx is `context.Context`; a is `*recruittx.Access`):

```
account.NewRecruitActorGuard(ctx, b *recruittx.Binding, a *recruittx.Access,
    p freshsource.Profile) (*account.RecruitActorGuard, error)
domestic.NewRecruitWallet(ctx, b *recruittx.Binding, a *recruittx.Access,
    p freshsource.Profile) (*domestic.RecruitWallet, error)
world.NewRecruitCityLocker(ctx, b *recruittx.Binding, a *recruittx.Access,
    p freshsource.Profile) (*world.RecruitCityLocker, error)
march.NewRecruitParticipant(ctx, b *recruittx.Binding, a *recruittx.Access,
    p freshsource.Profile, catalog *march.RecruitCatalog) (*march.RecruitParticipant, error)
```

Names above identify packages; declarations are in their respective packages.
Each copies profile and relevant expected object map; MIL captures an immutable
catalog snapshot (or privately clones it), including all retained versions. Reject
nil/invalid values, different Binding/source/shard, changed metadata/privileges,
missing artifacts or validation transaction end failure; discard all on failure.
Checks cover exact reviewed shape and object/allocator identity, roles, source,
qualified names, dependencies and privileges, not just names or observed stamps.
APP projects the reviewed source profile into these fixed `Objects` inventories;
constructors reject missing, additional or duplicate projection keys, not choose
sets from caller input. All other source/profile fields must be identical across
projections. Inventories and shape validation are requirements, not claims that
the current partial validators already establish full enrollment:
- ACCOUNT: `account`, `account_pkey`, `uq_account_login_name`,
  `account_account_id_seq`, `account_session`, `account_session_pkey`,
  `idx_account_session_account`, `player`, `player_pkey`,
  `uq_player_account_per_server`, `idx_player_account`. Inspect the reviewed FK
  and RI-trigger semantics as well; the current `fresh_actor_tables.go` table
  projection alone is explicitly partial.
- DOM: `player_wallet`, `player_wallet_pkey`; exact columns, PK, dependencies,
  privileges and unexpected-object rules are checked against `003_domestic.sql`.
- WORLD: the exact `worldSourceNames` inventory from `fresh_source.go`:
  `map_cell`, `map_cell_pkey`, `player_city`, `player_city_pkey`,
  `player_city_server_id_x_y_key`, `idx_player_city_owner`, `player_city_id_seq`.
- MIL: exact `freshBaseNames`, `freshQueueNames`, `freshRetainedNames` and
  `work_queue_id_seq` from `march/fresh_source.go`: `mil_city_origin`,
  `mil_city_origin_pkey`, `city_troop`, `city_troop_pkey`, `work_queue`,
  `work_queue_pkey`, `idx_work_queue_due`, `idx_work_queue_player`,
  `mil_recruit_origin`, `mil_recruit_receipt`, `mil_recruit_origin_pkey`,
  `mil_recruit_origin_server_id_player_id_operation_command_id_key`,
  `mil_recruit_receipt_pkey`, `work_queue_id_seq`. Validate the sequence and
  complete reviewed index/constraint/FK/trigger semantics, not just names.
Unexpected indexes, constraints, triggers or dependencies of these inventoried
objects fail closed unless a separately reviewed release changes this inventory;
unrelated reviewed schema objects are not prohibited merely by existing.

The current actual `world.PGStore.LockCityOwnerInTx` accepts raw pgx and is NOT
this port. Existing fresh-create participants/Wallet initialization do not prove
existing-wallet debit or city authorization. Constructors own no Begin/end.

APP publishes only the complete same-generation set with the fresh-participants
close-and-drain controller and external retention/writer/DDL/restore exclusions.
Acquire a generation lease before Begin, retain through cleanup and outcome
classification. Pin relation locks before row locks, revalidate exact metadata
under pins before business SQL. Use fixed pin order ACCOUNT account/player;
DOM player_wallet; WORLD player_city; MIL mil_city_origin/city_troop/work_queue/
mil_recruit_origin/mil_recruit_receipt. Use ROW SHARE for ACCOUNT and WORLD,
ROW EXCLUSIVE for DOM and all MIL relations (the conservative common mode for
readback and writes). Reconcile modes and earlier pins with the
fresh-create order for coexisting commands, no inverse pin acquisition. Pins do
not fence sequence manipulation or external writers. No raw transaction, pool,
row iterator, lifecycle operation, nested readiness read, Hub or cache operation
escapes to a participant; use bounded `Access.Scan/Exec` and ordered paging.

## 2. Values and port surface

The following are exact selected exported declarations to implement, with field
names/types fixed. `time.Time` values are canonical UTC milliseconds; durations
are positive integral seconds. `Scope` always means authenticated actor and
captured shard, operation 1, never request authority. Structs are copied values;
only APP creates them from authenticated context and validated transport.

```
// package march
 type RecruitCommandID [16]byte
 type RecruitScope struct { ServerID int32; PlayerID int64; CommandID RecruitCommandID }
 type RecruitIntent struct { Version uint32; CityID int64; UnitCfgID, Count int32 }
 type RecruitAcceptance struct {
     QueueID, CityID int64
     UnitCfgID, Count int32
     Cost Resources // Food, Wood, Iron, Stone int64; no gold
     DurationSeconds int64
     CatalogVersion string
     RuleDigest [32]byte
     AcceptedAt time.Time
     InitialStatus int16
     InitialStartAt, InitialFinishAt time.Time
 }
 type RecruitCandidate struct { ServerID int32; PlayerID, CityID, QueueID int64 }
 type RecruitCompletion uint8
 const (RecruitCompleted RecruitCompletion = 1; RecruitAlreadyDone RecruitCompletion = 2;
        RecruitEarly RecruitCompletion = 3; RecruitWaiting RecruitCompletion = 4)
```

Acceptance is immutable historical fact, not a current wallet/stock snapshot;
strings, arrays and times are copied, no retained mutable slices. It is not the
legacy `march.RecruitResult` or current `RecruitTroopResponse`. Its initial
schedule is not overwritten on promotion. Transport separately decides encoding,
trace and any independently authorized current reads. Scope/intent must be carried
internally for exact validation, not exposed across actors. ID is 16 nonzero
bytes. Preserve the full uint32 version and exact typed tuple through Find and
History, before any validation or cast: an accepted same-key different version
(including 65537) is conflict. Only after dual absence may a new intent require
exactly version 1; only then convert to the existing receipt smallint value 1.
Never narrow to compare, and do not alter DDL. Other intent fields use command
§1, not hashes or wire bytes.

```
// Every method below receives ctx and a; Pin methods take no other argument.
account.(*RecruitActorGuard).Pin(ctx, a) error
account.(*RecruitActorGuard).Lock(ctx, a, accountID, playerID int64) error
domestic.(*RecruitWallet).Pin(ctx, a) error
domestic.(*RecruitWallet).Lock(ctx, a, playerID int64) (*domestic.LockedRecruitWallet, error)
domestic.(*LockedRecruitWallet).Debit(ctx, a, cost domestic.Resources) error
world.(*RecruitCityLocker).Pin(ctx, a) error
world.(*RecruitCityLocker).Lock(ctx, a, playerID, cityID int64) error
march.(*RecruitParticipant).Pin(ctx, a) error
march.(*RecruitParticipant).Find(ctx, a, scope RecruitScope) (queueID int64, found bool, err error)
march.(*RecruitParticipant).ReverseAbsent(ctx, a, scope RecruitScope) (bool, error)
march.(*RecruitParticipant).History(ctx, a, scope RecruitScope, intent RecruitIntent,
    queueID int64) (RecruitAcceptance, error)
march.(*RecruitParticipant).Prepare(ctx, a, scope RecruitScope, intent RecruitIntent)
    (*march.RecruitAdmission, error)
march.(*RecruitAdmission).Cost(ctx, a) (march.Resources, error)
march.(*RecruitAdmission).Write(ctx, a) (march.RecruitAcceptance, error)
march.(*RecruitParticipant).CompletionHint(ctx, a, c RecruitCandidate) (status int16, err error)
march.(*RecruitParticipant).DoneHistory(ctx, a, c RecruitCandidate) error
march.(*RecruitParticipant).Complete(ctx, a, c RecruitCandidate) (RecruitCompletion, error)
```

`Pin` implementations acquire only their listed relation pins. ServerID is the
captured positive shard in ACCOUNT/DOM/WORLD. ACCOUNT Lock first locks the exact authenticated account row FOR SHARE and
requires status 1; then locks the exact `(server_id, player_id)` player row FOR
SHARE and requires its account_id equal the authenticated account ID. Both locks
remain held through transaction end, protecting account status and association.
This selects a conservative strengthening of command §3's player FOR KEY SHARE
minimum at the same actor rank; it adds no new semantics and makes no claim that
KEY SHARE cannot block an account_id change. No later actor upgrade after wallet;
coexisting old writers still require full lock-order and compatibility inventory.
DOM Lock requires an
existing initialized wallet, validates bounds, selects FOR UPDATE even for zero
cost/history/completion, never creates, settles, adopts or caches. Debit is
one-shot, checks nonnegative exact four-field cost, sufficient funds and affected
row count; it retains a private Access value snapshot and rejects different/ended
transactions. `world.Lock` uses qualified SQL, exact shard/player/city and
FOR UPDATE; ownership mismatch cannot be treated as readiness.

All pointer-handle fields are private, zero/nil invalid, private state shared on
copies, one-shot transitions cannot be reset; `RecruitAdmission` retains a
private Access snapshot and checks `CheckSameTransaction` on Write. No public
constructor for handles, no ability to read a raw tx or to issue arbitrary SQL.
`Cost` validates the same live transaction and returns a value copy; `Write` and
`Debit` have no callback, and a public
proof/boolean is not requested. These ports cannot by themselves prove that DOM
was called; their only production caller is the fixed APP call graph below.
Participants verify bound Access/source at every operation. APP rolls back on
any error, including a partial write, never calls Write after failed Debit, and
never returns Write's tentative result before confirmed commit.

Find is a post-wallet-barrier NEW statement joining scoped origin/receipt only as
an unlocked hint, not a claim. It reports unavailable on malformed/partial matches;
if found, History locks the indicated queue then receipt, re-reads origin, queue
and receipt, verifies exact scope/intent and immutable rule evidence/bijection and
legal evolution. Changed intent returns conflict even if today's city/catalog is
invalid; corrupted/missing link returns unavailable. No historical city/stock lock,
readiness check, mutation, debit, ID allocation, promotion or quest hint. If Find
is absent, ReverseAbsent checks exact scoped origin across ALL statuses in its own
post-barrier statement. A surviving origin/job without its matching receipt is
unavailable, not eligible for Debit. Epoch provenance and writer/retention fences
are essential to interpreting dual absence; both-side deletion cannot be detected.

Prepare is called only after WORLD Lock. It locks and validates marker, ALL stock
ascending unit ID, then complete pending type3 queues ascending queue ID, then
reads relevant immutable origin/receipt evidence without row locks under the
certified immutability/retention fence. It takes no existing receipt row locks
before inserting its freshly allocated queue identity. It validates the full set and all
linked origin/receipt/retained catalog evidence, including wrong-owner/malformed
rows; validates readiness and aggregate representable capacity, current catalog
and plan. No repair, fallback, legacy adoption or partial-page success. After all
locks/reads, it samples database `clock_timestamp()` once and floors to canonical
UTC milliseconds, checks range, scheduling and arithmetic; allocates a safe shared
queue ID under city serialization. It returns the private plan and copied exact
cost; no wallet/queue/receipt write. Sequence gaps are allowed on rollback.
Write inserts exact typed v1 job, reverse origin and immutable receipt under the
same transaction, verifies affected rows/readback and returns the proposed result;
errors force rollback. It cannot substitute request-supplied catalog evidence.

CompletionHint reads exact candidate without row locks after wallet as a hint.
DoneHistory locks queue then receipt and revalidates exact actor/city/queue,
origin, immutable evidence and done state; does not require current owner. If it
is not still valid done, return unavailable/restart rather than acquire an earlier
lock. Complete requires WORLD Lock first, then repeats complete marker/stock/
pending/queue/receipt validation in global order. Re-read target after locks:
valid waiting or active early has no effects; due active atomically credits stock,
marks done and promotes exactly the oldest waiting after validating its evidence
and time arithmetic, all conditional writes checked. A state that changed to done
must be fully validated; return AlreadyDone with no credit/promotion. Missing,
canceled, unknown or corrupt is unavailable. Canonical T is sampled once after
locks and full reads; no partial completion on successor failure. No receipt edit.

## 3. Fixed APP orchestration and outcomes

For user admission authenticate the existing session/account/shard before each
transaction. For a scanner, use its trusted service execution and independently
resolve the candidate actor/account association from authoritative data; never
pretend an unauthenticated candidate is a player session. Validate
positive identities, exact captured shard, command bytes and typed input. APP alone
owns `Binding.Begin`, Owner/access and bounded noncanceled cleanup. Use READ
COMMITTED and relation pins followed by actor → initialized wallet → optional city
→ marker/stock → queue → receipt; never take an earlier rank later. Copies of
Access reference one exact active transaction. No Hub mutex while PG locks held.

Admission/replay: after actor/wallet, Find. If present, History then end read-only
transaction and return immutable acceptance only after successful end. If absent,
ReverseAbsent and fail on orphan. For any required existing DOM production
settlement, end this read-only transaction first, perform the legitimate settlement
fully outside it, then start a new leased transaction and repeat auth, source,
barrier and both lookups from the beginning. Settle at most once per invocation;
if the repeated lookup is still absent continue admission rather than looping.
Settlement is not recruit debit and
must not be a prerequisite for reporting historical acceptance. On eligible absence,
lock current city, Prepare, copy/check each cost field, Debit, Write, and commit
exactly once. No cached wallet/stock publication under PG locks. Confirmed commit
returns acceptance; invalidate/reload caches only after end and report cache
failure without undoing or re-executing acceptance. A concurrent same-key request
serializes on wallet and observes the committed result in a fresh statement.

Completion: candidate discovery is unlocked, active-due only and bounded keyset
scan per queue §5. After actor/wallet, use CompletionHint. A done hint takes
DoneHistory; active/waiting hint takes WORLD Lock then Complete. Re-evaluate under
locks as above. Commit only a fully validated transition; done/early/waiting are
no-effect dispositions. A failed candidate does not block later candidates; reset
cursor at end-of-pass and restart from fresh scan after process restart.

Validation/business rejection and intent conflict are distinct from unavailable
(source drift, missing retained evidence, orphan, invalid state, SQL or resource
failure). Auth failure must not disclose another actor's key; insufficient resources
is a definitive precommit business rejection. Every precommit error rolls back;
no accepted receipt or independently committed pending claim is created. A commit
error after actual invocation is UNKNOWN, not rejection, refund or new-key retry.
Commit success is the only normal success; retain key/queue diagnostic on unknown.
Failed/uncertain rollback or lost server transaction poisons/closes admission.

For unknown admission use a fresh authoritative same-Binding connection and READ
COMMITTED actor/wallet barrier; new post-barrier Find/ReverseAbsent statements and
History validate exact evidence. A consistent receipt resolves accepted; both
absent after the original transaction has resolved permit explicit same-ID,
same-intent submission, not automatic debit; orphan/contradiction is unavailable.
A timeout, barrier failure or unestablished old-server resolution remains unknown.
Completion resolution uses the same barrier and hint/done-history or full current
city path: done is committed without repeating credit; active due may be retried
only after known rollback and current authorization/readiness; waiting/early are
no effect, not proof of prior completion. Preserve unknown on cleanup attempt.
Local lease release/Owner ended/timeout is not server resolution: keep unknown
work counted and drain unresolved until independently verified transaction end;
close is not drained, and no online reopen/clear-unknown API exists. Resolution
readback is a narrowly controlled recovery operation of the closed generation,
not new business admission; it cannot weaken the external fence or declare drain
merely by starting a new transaction. New startup requires fresh audit/provenance.

## 4. Isolation, side effects and verification gates

Before activation inventory and exclude incompatible old RecruitWithWallet/Hub
callbacks, queue and stock writers, GM/import, flush/hydration, allocator/retention
writers, march debit/return and other old binaries; same-city compatible writers
must take WORLD city lock and capacity discipline. Routed StartMarch rejects before
hero/force/stock effects until separately compatible. Do not mirror SQL state into
a mutating Hub during the transaction. Maintain exclusions through the last
possibly live transaction, and retain coherent queue/origin/receipt/allocator and
all referenced rule artifacts across restore. The controller cannot attest external
fences or turn an incomplete audit into activation.

Actual `internal/api/military_handlers.go` calls `questAfterTrainTroops` after the
legacy callback; `internal/api/quest_progress_hook.go` ignores progress errors and
has no durable idempotent delivery. It cannot provide reliable exactly-once quest
progress on crash/unknown commit. Do not invoke it on replay/completion or claim
it is transactionally delivered. If quest progress is required, separately freeze
and implement a durable atomic enqueue plus idempotent consumer/recovery boundary
before enabling that behavior; do not add an outbox or fake delivery here.

Independent SPEC review and affected ACCOUNT/DOM/WORLD/MIL/API/client coordination
precede implementation. Isolated component tests may use the existing owned
WORLD→MIL fresh fixture and trusted fixture profile/catalog in parallel with
unfinished natural fresh DOM/APP; that fixture proves neither natural creation nor
activation. Follow-on tests include wrong Binding/ended/copied handles; source and
catalog drift; concurrent account-status changes and player-account reassignment
blocked through commit/rollback (including absence and mismatched account);
same-key concurrent/restart replay and conflicting intent, including versions
0, 2, 32768, 65537 and MaxUint32 with no narrowing; done
orphan/reverse mismatch; ownership changes; same-wallet cross-city serialization;
all pending pages/capacity; failpoints around every debit/job/origin/receipt and
credit/done/promotion write; actual PG17 commit and rollback barrier branches,
unknown server transaction/no false drain; real process kill/restart; scanner
progress past bad candidates; and separate full natural fresh-create/combined
end-to-end acceptance. Review final head, applicable tests and required CI, audit
and operational fences before activation. Documentation or fixture success alone
is not runtime, production, migration or recovery evidence.
