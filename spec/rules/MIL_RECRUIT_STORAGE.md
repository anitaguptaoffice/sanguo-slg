# MIL Recruit physical storage identity — review proposal

task_id：`SPEC-DURABLE-RECRUIT-STORAGE-001`；任务：[#1827](https://github.com/anitaguptaoffice/sanguo-slg/issues/1827)。
基线：main `9d1377d2380612c31c8ae23ddc698b5cbede2c5d`，tree `9e76b1f4cbd9de0a48c41ab405076f059604e0ac`。
依赖：[#1797 / PR #1798](https://github.com/anitaguptaoffice/sanguo-slg/issues/1797) 的 [应用命令边界](SLG_COMMAND_BOUNDARY.md)，[#1801 / PR #1802](https://github.com/anitaguptaoffice/sanguo-slg/issues/1801) 的 [招募队列](MIL_RECRUIT_QUEUE.md) 与 [招募命令](MIL_RECRUIT_COMMAND.md)，以及 [共享队列身份](queue_identity.md)、[维护脚本](../db/m4_008_work_queue_id_sequence.sql) 和 [DOM 绑定](../../internal/domestic/queue_identity.go)。

This is a proposed physical storage contract and gate for later implementation, subject to independent SPEC review and applicable freeze/notification. The merged semantic contracts remain authoritative. It does not claim durable Recruit is implemented, tested or active, and authorizes no SQL, migration, runtime wiring, privilege change or deployment. The dormant arithmetic planner in [#1799](https://github.com/anitaguptaoffice/sanguo-slg/issues/1799) / PR #1800 is not durability evidence. No legacy adoption, DATA-003 or protocol change is in scope.

## 1. Relation shape and identity

The following names, ordered columns and constraints are proposed for two MIL-owned relations in the same application schema and migration owner as `work_queue`. Both are permanent logged heaps: no inheritance/partitioning, RLS, rules, user triggers, identity/generated columns or unreviewed defaults. All columns are NOT NULL; reject implicit coercion and silent repair. Allow only the exact PostgreSQL-internal RI triggers for the reviewed receipt FK, on these two relations only, and validate their metadata. The generic `work_queue` retains its exact nine columns, one immediate PK and zero triggers; add no generic column, constraint, index, trigger or FK. Preserve DOM type1 load/delete and retained type3 rows.

`mil_recruit_origin` is immutable reverse identity retained independently of receipt and queue in every job state:

| Ordered column | Type | Constraint |
|---|---|---|
| `server_id` | integer | trusted bound shard |
| `queue_id` | bigint | 1..9007199254740991 |
| `player_id` | bigint | trusted authenticated actor |
| `operation` | smallint | exactly 1, RecruitTroop |
| `command_id` | bytea | exactly 16 bytes, not all zero |

Immediate validated nondeferrable PK `(server_id, queue_id)` and UNIQUE `(server_id, player_id, operation, command_id)` use bytewise equality. Queue IDs are schema-global despite the composite PK. Command bytes are opaque, not text, hash, trace ID or a newly generated retry ID. Intent version is outside the unique scope; unsupported versions cannot bypass it. There is deliberately no FK to `work_queue`: origin survives a missing queue row without changing DOM's binding. Origin, job, debit and receipt are inserted in one transaction; no independently committed claim.

`mil_recruit_receipt` is immutable acceptance evidence, not current state:

| Ordered column | Type | Constraint |
|---|---|---|
| `server_id`, `queue_id` | integer, bigint | PK and FK to origin `(server_id, queue_id)` |
| `intent_version` | smallint | 1 for accepted v1 |
| `city_id` | bigint | exact intent and linked job city |
| `unit_cfg_id`, `count` | integer, integer | unit 1..4; count > 0 |
| `food_paid`, `wood_paid`, `iron_paid`, `stone_paid` | bigint each | each >= 0; no gold |
| `duration_sec` | bigint | > 0; checked conversion and addition |
| `catalog_version` | bytea | nonempty exact immutable manifest identifier bytes |
| `rule_digest` | bytea | exactly 32 bytes, SHA-256 of trusted canonical rule |
| `accepted_at`, `initial_start_at`, `initial_finish_at` | timestamptz each | finite UTC millisecond instants, years 0001..9999 |
| `initial_status` | smallint | 0 or 1 |

PK and FK are immediate, validated and nondeferrable; FK uses `ON UPDATE RESTRICT ON DELETE RESTRICT`. Receipt has no duplicate scope columns and no FK to generic queue. Origin PK and unique scope plus receipt PK provide at most one origin per queue and scope and at most one receipt per origin; they do not prove both sides or a matching job exist. Each participant validates server/player/city/type3, intent, payload/rule, origin and receipt equality and legal live schedule evolution in the same transaction. Initially active start equals acceptance time and finish equals start plus stored duration; waiting estimates follow the queue contract. Timestamp range/millisecond checks and schedule arithmetic must avoid timezone-dependent interpretation, precision loss and overflow; future SQL checks, exact catalog validation and runtime readback need independent PG17 review. Cross-row and trusted catalog consistency cannot be established by CHECK alone.

Certified writers never UPDATE origin or receipt; writer discipline and retention/maintenance fencing establish semantic immutability, not immunity to privileged deletion. Type3 payload retains the exact v1 schema and strict typed producer/trusted catalog validation before JSONB in the queue contract. Live status/schedule can evolve 0→1→2; receipt captures initial acceptance. Historical acceptance uses retained trusted rule evidence, never today's price; missing evidence is unavailable. Catalog identifier grammar, canonical rule encoding, manifest ownership/distribution and exact index metadata remain separately reviewed decisions.

This requirement does not block writing SQL source or separately authorized isolated tests; target database DDL execution requires its own authorization and a reviewed rollout. After table creation and before binding or activation, verify actual application-role SELECT, INSERT and receipt row-lock rights under approved policy. Missing or unverifiable rights block binding and activation; do not automatically grant privileges, alter roles, use SECURITY DEFINER or skip locks. Preserve queue→receipt lock and re-read order from the command contract.

## 2. Absence proof and epoch fence

After authentication and actor lock, acquire the initialized same-actor wallet `FOR UPDATE`, including historical lookup and zero-cost cases. After that barrier, revalidate the trusted bound source, cohort epoch, live certificate and fence; use NEW READ COMMITTED statements for exact scoped receipt lookup and exact scoped origin lookup across ALL retained states. Each statement has its own snapshot. A missing receipt alone never licenses a charge. Origin without matching receipt/job, a mismatch, canceled/unknown state or missing retained rule evidence is unavailable, not eligible absence. For a found receipt, discover its queue, lock queue then receipt and re-read both before validating. Historical reporting requires current authentication and validated linkage, not today's city owner/readiness; new admission and completion mutations require current owner/readiness. Reporting a validated already-done transition does not.

At activation and after restore or revalidation, independently prove fresh-cohort atomic creation and perform a complete coherent audit of all retained cohort job/origin/receipt identities plus external provenance. Incomplete pages or unclassified rows block the epoch. The audit cannot recover a true key after origin corruption or prove history after all identity evidence is deleted; neither stock nor wallet reconstructs it. A complete anti-join alone does not prove provenance.

Thereafter preserve the proof inductively with certified atomic writers, immutable identities and continuous retention, DDL, allocator and legacy-writer fences. Valid epoch plus both exact post-barrier absences establishes eligible absence only; current city, stock, capacity and catalog checks still apply before spending. A whole-cohort anti-join on every debit is unnecessary; it may be an optional complete and correct fallback only under the same provenance and fence, never a substitute for them.

A cached valid flag is insufficient. A separately reviewed revocation/epoch invalidation interlock or operational drain must keep the fence valid through commit and prevent a command committing after invalidation. Its enforcement and authority are unresolved activation gates: fail closed until demonstrated. Restore, revocation or out-of-band uncertainty invalidates the epoch; reopen only after complete coherent re-audit and independently verified provenance. Never guess repair, adopt or reconstitute identity.

A proposed separately retained, tamper-evident activation certificate is issued only after independent audit and identifies cluster/database/schema, role/pool binding, shard/cohort epoch, relation/index/sequence identities and migration/checksum, retained highwater/reference inventory, snapshot/restore provenance, trusted catalog artifacts, fresh-city creation proof and complete all-state coverage. It inventories and fences old stock/queue, Hub/callback, march, GM/import, flusher and other writers, and specifies fence ownership, expiry/revocation, revalidation, through-commit interlock or drain, and each enforcer. Missing, stale, partial, restored or unverifiable certificate closes the cohort. A certificate never replaces source checks or exact post-barrier lookups. Issuer, format, enforcement and durable external evidence require separate review. Unknown legacy type3 evidence blocks unless independently reviewed inventory proves it outside the cohort; no automatic adoption.

## 3. Allocator inventory and lifecycle

The existing [m4_008](../db/m4_008_work_queue_id_sequence.sql) rejects every additional same-schema `queue_id` or `queue_ids` column. Before origin is created or any ApplySpecs replay sees it, a separately reviewed amendment must explicitly inventory both `mil_recruit_origin.queue_id` AND `mil_recruit_receipt.queue_id`. Renaming or arbitrary exemptions do not satisfy this requirement. Validate exact relations/columns, origin PK/unique/checks, receipt PK/FK/checks, namespace, owner, persistence, access method, privileges, index properties and absence of unexpected inheritance/RLS/rules/triggers other than the exact FK RI triggers. Reject lookalikes, extra references, wrong metadata, invalid IDs and unknown opaque/cross-schema references until externally inventoried.

Scan all retained IDs from BOTH new tables in all states, including origin without queue/receipt. Receipt orphan, invalid FK or corrupt identity fails closed before `setval`; never ignore it. Under an external fence/drain of all allocators, writers and concurrent DDL, calculate `H = max(queue rows, origin rows, receipt rows, independently documented external retained references/highwater)`. Preserve greater existing sequence state, fail at exhaustion and move only forward after all validation. Sequence remains schema-qualified bigint, 1..9007199254740991, increment/cache 1, no cycle, owned by none. `setval` may survive rollback: never lower or recreate the sequence as rollback. Restore queue, origin, receipt, sequence, catalog and reference/fence evidence coherently, then repeat the forward-only audit even with a migration ledger.

The future design must prove each entry state before production migration SQL is finalized or released, or executed in a target database. Separately authorized isolated, disposable prototypes may establish that proof; they do not authorize release or target-environment rollout:

1. **Precreate:** old m4_008 must run before origin exists; install a reviewed replacement or compatible coordinator/ordering before creation.
2. **Body completed, ledger absent:** ApplySpecs may replay m4_008 and its current body rejects origin. Permit replay only with a reviewed compatible amendment that validates and inventories both exact new relations; otherwise fail closed.
3. **Ledger present:** ledger proves neither current shape nor highwater nor restored provenance; perform explicit maintenance audit.
4. **Restore or partial restore:** verify coherent snapshot, retained references and sequence against external monotonic evidence. Missing ledger/evidence or uncertain/lowered provenance closes the cohort; do not create missing halves or adopt data.
5. **Unknown or wrong preexisting origin:** reject it; never adopt by name through `IF NOT EXISTS`.

Whether to amend historical migration bytes or introduce a narrowly reviewed preflight/replay coordinator is unresolved. Prove all five states and checksum/old-deployment compatibility before choosing; do not assume ApplySpecs permits rewriting an already-ledgered file. This proposal changes neither migration nor binding.

## 4. Transaction and recovery requirements

APP captures and revalidates authoritative pool/database/schema/role/shard/cohort and relation/allocator identities, acquires a connection from that exact pool, begins READ COMMITTED and owns the only commit/rollback. Private one-shot participant capabilities bind the exact connection and transaction object, metadata and active lifetime; matching metadata strings or a caller-supplied raw tx alone do not prove origin. Reject different pool/DB, changed OID/role/schema, substituted or ended tx and reused connection. Participants do not Begin/Commit, call Pool.Exec, invoke Hub/cache or start nested readiness reads. Use the merged order actor → wallet → city → applicable marker/stock → queue → receipt; all same-actor cities serialize on the initialized wallet, with no historical wallet creation.

After locks and complete validation, sample the DB clock once and floor to milliseconds; allocate from the shared sequence only after city serialization. Debit, queue, origin and receipt commit together; rollback gaps are harmless. Commit transport failure is UNKNOWN, never assumed rollback or refund. Fresh same-pool READ COMMITTED readback waits behind the wallet and uses new exact all-state statements: consistent receipt proves acceptance; fully certified absence after resolution permits same-key/same-intent resubmission. Timeout, source drift, orphan, contradiction or failed retention provenance remains unknown or unavailable. No new key, blind retry, repair, cache publication before commit, SQL-to-mutating-Hub mirror, automatic legacy adoption, repricing, added queue cap or key expiry without a separate safe retry-expiry contract.

## 5. Follow-on gates and future verification

Separate reviewed cards must specify PostgreSQL 17 DDL/catalog identity validation, replay-safe allocator rollout and checksum compatibility; MIL/APP/DOM exact-tx ports, typed producer, trusted catalog, fresh-cohort proof and complete writer fencing; certificate authority/revocation/restore evidence and the through-commit interlock or drain; and any transport identity/result adaptation. Source merge alone authorizes none of these or production activation. Actual role/column privileges remain unknown; inspect without granting under separately authorized conditions. Applicable independent SPEC review, freeze and notification precede dependent implementation.

Future isolated tests must cover:

- PG17 backend version and metadata, exact DOM binding/type1 behavior and existing row-lock rights without grants; reject wrong schema/owner/role/OID/shadow, pool, tx, ended/reused capability and missing rights. The [SQL validator](../db/validate.sh) can fall back to PostgreSQL 16; its success alone is not PG17 evidence.
- All five allocator entry states, duplicate migration and rollback after setval; coherent/partial/lowered restore; origin-only and receipt-retained highwater; receipt orphan/invalid FK; external references, invalid/ceiling IDs, unknown references and fence violations.
- Concurrent same key/equal intent yielding one debit/job/origin/receipt; changed city/unit/count/version conflict; different actor/shard isolation. Missing receipt with pending/done/canceled/unknown origin/job, missing queue, mismatch or missing rule evidence blocks debit. Epoch audit catches missing origin with retained queue and covers all pages.
- Missing/revoked/stale certificate, unclassified data, unsupported writer and restore uncertainty close the epoch. Race invalidation against in-flight commit to prove interlock/drain prevents post-revocation commit; reopening requires full re-audit. Cached flags alone fail.
- Wallet-barrier readback waits for original COMMIT and ROLLBACK independently; fresh statements observe full acceptance or certified absence; timeout remains unknown. Kill the actual owned child before debit, after debit/job/origin/receipt before commit, and after commit before reply; verify exit and new-process restart, plus separately injected commit-ack loss and no duplicate debit.
- Complete pending FIFO scan/capacity/overflow and clock/due boundaries; active→done and oldest promotion atomically, including crash after credit/done/promotion before commit and after commit. Scanner passes transient bad candidates to later healthy work. Catalog replacement never reprices retained evidence; missing trusted manifest is unavailable.

No SQL, runtime, migration, production, crash/restart or PG17 tests are claimed by this proposal.
