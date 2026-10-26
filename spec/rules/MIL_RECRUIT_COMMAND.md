# MIL Recruit acceptance identity and readback

任务：[SPEC-DURABLE-RECRUIT-SEMANTICS-001 / #1801](https://github.com/anitaguptaoffice/sanguo-slg/issues/1801)。
基线：`851ea623b4de59db7cd50ba114fa371632545056`；遵循已接收的 [SLG 应用命令边界](SLG_COMMAND_BOUNDARY.md)。
本文件与 [MIL_RECRUIT_QUEUE.md](MIL_RECRUIT_QUEUE.md) 共同构成一个配对语义契约，须联合审阅、联合冻结；不能单独宣称完整。
以下规定约束后续设计与实现，不是已实现保证、运行时验收结果或启用许可；纯计算 planner 不变，也不证明持久接受。
物理 receipt DDL、catalog canonical encoding / distribution、具体 Go 端口和 transport 仍须后续独立 SPEC 冻结；本文不执行或宣称恢复测试通过。

## 1. Stable identity and exact intent

Internal CommandID is exactly 16 opaque nonzero bytes, compared byte-for-byte (no collation/case/Unicode normalization). Caller persists it before first submission and reuses it across transport retries/restarts. Production source/transport of this value is NOT present in existing RecruitTroopRequest; a separately reviewed protocol/caller change is required before exposing retry-safe admission. Do not reinterpret trace IDs or generate a fresh command ID inside each request handler.

Dedup scope is `(server_id, authenticated player_id, operation=RecruitTroop, command_id)`. Intent version is NOT part of the unique scope: using same key with different version must mismatch, not bypass dedup. Exact canonical intent tuple is `(intent_version=1, city_id:int64, unit_cfg_id:int32, count:int32)` plus the trusted scope. Fixed-width typed comparisons; JSON/protobuf byte order and hash equality are not equality proof. Price/catalog/current time/wallet/trace ID are not caller intent. Authenticated actor and bound shard come from existing trusted auth, never caller override.

Same key/scope + equal tuple replays acceptance; unequal tuple returns conflict without writes. Same CommandID bytes under another actor/shard/operation are an independent namespace and disclose nothing about the first. Equal tuple with different key is a separate request and may spend again. If an attempt definitively fails before commit it has no accepted receipt: server cannot prove an earlier rejected tuple without a separately persisted rejection ledger, which this contract does not add. Trusted caller MUST keep key→intent stable nonetheless; server promises mismatch detection only against committed acceptance. No pending claim is independently committed. Default retention never expires/reuses accepted keys; later pruning requires explicit safe retry-expiry contract.

## 2. Acceptance record and bijection

Logical immutable receipt fields:
- scope and exact intent tuple;
- server/player/city/type3/queue ID linkage;
- unit/count/exact paid four-resource cost/integral duration;
- retained catalog version and rule digest;
- canonical accepted processing time, initial status0 or1, initial start and finish estimates.

EVERY retained Recruit job logically retains the immutable reverse scoped command identity regardless of current status, including done/canceled/unknown status, `(server_id, authenticated player_id, operation=RecruitTroop, 16-byte CommandID)`. Its storage/index representation is a future SPEC/metadata-compatibility decision, not a new generic work_queue constraint here.

One accepted scoped command has exactly ONE durable recruit queue; one durable recruit queue is linked by exactly ONE accepted command. Require unique command scope AND unique `(server_id, queue_id)` linkage, plus exact equality of the job reverse scoped command identity with the receipt identity and identical server/player/city/type3/immutable rule fields. Constraints physical ownership is future receipt-DDL card; never add generic work_queue constraints that break exact-shape DOM readers. A queue ID alone, existence of any row, or FK without owner/type checks is insufficient. MIL participants validate the bijection and immutable evidence within supplied tx; missing/contradictory links are unavailable/quarantined diagnostics, never debit again or manufacture a receipt.

Result is an immutable **acceptance result**, not a byte-identical legacy RecruitTroopResponse and not current wallet/troops. It identifies accepted queue/city/unit/count, cost/duration, initial accepted schedule/status. Receipt contains NO promise that today's wallet/ready stock equals the state at acceptance. If public transport later requests current state it needs separate authorized reads labeled current. Trace correlation is generated per response, outside stored intent/result. Existing wire adaptation remains frozen and must not silently show old acceptance as live stock.

Queue identity/unit/count/cost/duration/rule version are immutable. Status0→1→2 and initially-waiting live start/finish evolve per companion queue contract. Receipt initial timestamps/status never update. Initially-active live schedule remains original; initially-waiting live schedule equals estimate until promotion, then exact actual start+stored duration. Done preserves actual schedule. Validate legal evolution, not equality of every current field to acceptance. Unknown/canceled phase or self-consistent but untrusted rule JSON is not accepted historical proof. Validation uses trusted retained catalog version, never today's price.

Debit + job + receipt commit together; no independently committed receipt/claim or fallback. Coordinated consistent snapshot/backup/restore and retention fences MUST retain BOTH sides, reverse command identity evidence, catalog evidence and shared allocator state/reference inventory. Arbitrary deletion or inconsistent restoration of BOTH receipt/job and all identity evidence is not detectable or reconstructible from current stock/wallet; this contract does not promise that impossible recovery. An uncertain restored cohort MUST remain closed: apparent absence cannot authorize retry until coordinated restore/retention provenance is verified; do not resume by assuming missing identity means never accepted. Missing half after restore is unavailable, not absent command eligible for spending. No deletion while supported retries can reference either side.

## 3. Full global order and transaction lifetime

Use existing broad lifecycle order and make its recruit subset explicit:
1. authenticated actor `player(server_id,player_id)` FOR KEY SHARE;
2. initialized `player_wallet(server_id,player_id)` FOR UPDATE (even zero cost / historical lookup / completion);
3. WORLD `player_city(server_id,city_id)` FOR UPDATE, cities ascending if ever multiple;
4. heroes ascending ID, then force/assignment (not touched by Recruit);
5. military city provenance marker, then all stock ascending unit ID;
6. military queue/order/army identities ascending within each class in fixed order queue→order→army (Recruit only queues);
7. acceptance receipts in `(server,player,operation,command bytes)` order;
8. NPC state (not touched by Recruit).

Acquire only applicable locks, never take an earlier rank after a later rank. Candidate discovery / historical receipt discovery may read without locks; observations are hints, then acquire relevant locks and re-read before effects. All same-actor commands, including different cities, serialize on the SAME initialized wallet row. No wallet creation/zero adoption during historical readback. Relevant writer discipline and actor lock conflict behavior must be preserved across existing participants; integration review must inventory all affected writers before activation. WORLD supplied-tx locker alone does not prove source binding.

Capture pool/database/schema/role/shard/cohort and all relation/allocator identities at startup and revalidate before command work. APP acquires connection from that exact captured pool, begins READ COMMITTED and owns commit/rollback. For each command it creates a private one-shot execution context holding exact acquired connection and exact pgx.Tx object; domain participant bindings are minted for that instance and validate exact tx/connection identity + source metadata + active lifetime before each operation. They cannot retarget or accept a different raw tx. Commit/rollback invalidates the instance, even if the pool later reuses the connection. Treat the opaque context as transaction provenance, not merely a bag of matching schema strings.

This is a bounded Recruit wiring boundary, not a generic UoW framework. Exact cross-package Go surface is an APP/domain interface-design card, with these observable acceptance requirements: substituted tx on same connection after end rejects; same schema other pool/DB rejects; role/schema/OID change rejects; caller cannot invoke a participant after end; no participant Begin/Commit/Rollback/Pool.Exec/Hub/cache. Public raw-pgx methods may remain for other old use cases but cannot be the production Recruit participant escape hatch. No capability is minted from arbitrary caller-supplied pool/tx. Source checks and metadata are necessary together, neither alone proves exact transaction ownership.

Owned connection/tx cleanup on cancellation uses bounded noncanceled cleanup context; release only once. No Hub/cache mutex acquisition while PG locks held. Existing DOM production settlement, if needed, fully commits before entering this order; it is legitimate accrual, not part of recruit acceptance. Tests measure recruit debit against postsettlement W. No nested readiness.Reader.Read: it owns a different transaction and cannot establish this snapshot.

## 4. Historical lookup is distinct from new admission

Preserve existing authentication/session/shard checks, actor existence and account ownership checks. Historical lookup is authorized solely for the authenticated scoped actor's own acceptance, not by today's owner of the old city. Current city ownership/readiness/catalog choice are NOT prerequisites for reporting a historical fact. No mutation/marker repair follows from historical lookup.

Historical sequence: fresh bound authoritative READ COMMITTED tx → actor lock → wallet serialization lock → separate receipt lookup statement for exact scoped key AFTER lock acquisition. If present, read linked queue identity, acquire queue lock then receipt lock in rank order (no city/stock lock needed for historic-only validation), re-read both and verify tuple/bijection/immutable rule evidence/legal evolution. Return immutable accepted result even after valid promotion/done or subsequent current-owner/readiness change. Current auth revocation/missing actor/wallet, unavailable retained rule source, missing job or corrupt linkage means unavailable/unauthorized, NOT rollback. Do not leak existence through another actor's key namespace.

For new admission, after the fresh READ COMMITTED wallet barrier a missing receipt is NOT yet eligible absence: perform a separate exact reverse-scoped-command-key lookup across ALL retained Recruit job states, including done. Any surviving job for that key without its matching receipt is unavailable, never a new debit. Only receipt absence AND reverse-key absence after the barrier establish eligible absence; do not yet spend. Then acquire current WORLD owner, readiness, all stock/queue state and validate current catalog/planner/aggregate capacity. Allocate shared queue ID, debit, insert job/receipt and sole commit. When presence was found and immutable intent mismatches, conflict without new business validation or writes. Do not reject accepted replay because current price changed or unit disappeared from the current catalog.

Existing accepted command replay never allocates an ID, debits, promotes, emits a second quest hint or refreshes a historical snapshot into live cache. Failure to invalidate cache after confirmed acceptance does not revoke it.

## 5. Commit uncertainty and authoritative readback

Transport error during Commit yields UNKNOWN, not failed/refundable/retriable-with-new-key. Retain scoped key/allocated queue diagnostics. Resolve using a fresh connection from the same bound authoritative pool and READ COMMITTED; no replica, stale repeatable-read snapshot or pre-barrier absence. Actor/wallet barrier acquisition must finish; the original tx holds wallet lock through commit/rollback. Run the lookup in a NEW statement after barrier acquisition, so READ COMMITTED sees its resolved outcome.

After old transaction resolution: exact consistent receipt => accepted; absent receipt AND absent exact reverse scoped key across ALL retained job states, in post-barrier statements => same-ID/same-intent submission may proceed; any retained orphan, including done, => unavailable; contradictory receipt/job => unavailable. Timeout, cancellation, failed connection, missing-before-barrier or inability to establish old-tx resolution remain unknown. Lookup itself never generates identity or debits. Same-ID resubmission is an explicit command path under the same rules, not compensation.

Completion readback uses exact server/player/city/queue identity from validated candidate and same actor/wallet barrier, then applicable WORLD/readiness/stock/queue/receipt order. Unlike historical acceptance lookup, completion is a current-state mutation and MUST require current owner/readiness before retrying. If exact valid row is done, report transition committed with zero credit/promotion; do not require current owner/readiness merely to report an already-done historical transition, but do validate auth/immutable linkage. Therefore first inspect exact queue state after serialization as a hint: done follows historical validation path; active/waiting follows full current-state validation path without any queue lock acquired before city. Re-read after locks to decide actual state. Valid active+early=no effects; valid active+due after resolved rollback may retry. Waiting is no-effect/not-ready, not proof of prior completion. Missing/canceled/unknown/corrupt is unavailable. If state changes while acquiring locks, re-evaluate under locks without violating order.

No independent claim bit, phase flip or durable repair marker is introduced. Native worker restarts rediscover committed due work, not uncommitted intent. Completion-in-flight commit and rollback must both be tested separately from ack-loss injection.

## 6. Required future tests / scope

- Same key/equal intent concurrent and across real process restart: one debit/job/receipt, immutable replay before/after promotion/done/current catalog change/cache invalidation failure.
- Same scope/key changed city/unit/count/intent version conflicts. Same bytes different actor/shard are independent, with zero cross-disclosure; same actor across cities serializes wallet.
- Precommit rejection creates no accepted receipt; retry same tuple may succeed. Caller key-stability rule documented, no claim of rejecting changed uncommitted intent without persisted evidence.
- Done-orphan exact key followed by same-key retry never redebits; reverse scoped key mismatch on a present receipt/job pair rejects.
- Two receipts share queue; one receipt links wrong city/owner/server/type; wrong immutable cost/count/duration/version/digest; receipt exists/job missing and inverse orphan: unavailable, never new debit.
- Historical equal lookup after current city owner or readiness changes still returns original fact if auth/link/rule evidence valid; NEW admission/completion cannot bypass current owner/readiness.
- Fresh ReadCommitted lookup blocks behind original wallet lock; after COMMIT sees acceptance; after ROLLBACK sees eligible absence. Repeat for completion with done/promotion all committed vs all rolled back. Timeout/canceled lookup remains unknown.
- Kill before debit, after debit, after job, after receipt before commit, after commit before reply. Independently inject committed ack loss. Assert actual owned child exit and new-process restart, not merely returned error.
- Kill after completion credit/done/promotion-before-commit; invalid oldest waiting/time overflow cause no partial completion. Pair with queue scan progress/error cases.
- Exact source identity, foreign tx, reused connection after tx end, changed metadata, zero/missing wallet, auth denial; no hidden nested tx or precommit cache publication.

Remaining bounded choices requiring separate implementation contracts: receipt physical columns/indexes and migration metadata compatibility; trusted retained catalog manifest canonical encoding/owner distribution; exact owner-local Go token surface; public command identity transport and acceptance-result adaptation. These are not guessed into existing schemas/proto. Queue semantics/identity/readback/lock invariants above are the concrete decisions to review now. Implementation can proceed owner-locally only once its relevant interface/representation dependency is frozen; the timestamp-free pure arithmetic planner remains unaffected.
