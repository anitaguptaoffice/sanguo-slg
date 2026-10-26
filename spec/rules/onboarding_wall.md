# Bounded wall milestone 1006 and player-level floor 6

This contract introduces a new bounded phase-2 policy; it does not assert that existing gameplay or the original reference game defined level6 this way. Phase1, DATA-002 values, fixed payment keys and public protocol remain unchanged. Activation requires the full reviewed compatible implementation and writer fence below.

## 1. Decision and invariants

1. Add authoritative completion only for exact quest **1006**; a newly persisted v2-verified completed 1006 establishes a player-level **floor 6**.
2. Preserve phase-1 1001–1005 v1 verification, contiguous legacy-completed floor 1–5, starter receipt, original rewards, public Report denial, and client authority rules unchanged.
3. Keep all DATA-002 config, rewards, IDs, objectives, unlocks, item definitions, prices, durations, and content hashes unchanged. No XP system or level 7+ policy.
4. No new 1007+ / chain300 objective hook, proof, growth mapping, reward, or cumulative backfill. The existing daily event allowlist stays daily-only.
5. A historical completed row or successful reward receipt **alone never establishes floor 6**. Current server verification is indispensable.
6. Never lower persisted levels; write `GREATEST(existing_level, derived_floor)`. An existing level 20 remains 20.
7. No automatic accept or reward on reads/login. Read-side receipt repair is payment-state reconciliation, never a grant.
8. No cross-domain writes: QUEST owns quest rows; API reads owned-building facts and persists player level; CONTENT owns existing receipt/grant machinery.

## 2. Exact immutable identity

The single allowed identity is:

| Field | Required value |
|---|---|
| quest_cfg_id / code | 1006 / `chain200_wall` |
| quest_type / chain_id / sort_in_chain | 1 / 200 / 1 |
| prev_quest_cfg_id / unlock_level / repeatable | NULL-or-normalized-0 / 5 / false |
| objectives | exactly one: `{type:"build_level", building_cfg_id:7, level:1}`; all other objective members zero/empty |
| rewards | wood 800 plus item 2018 (`wall_stone_kit`) ×1; no other resource/item reward |

Validate the fixed identity at every 1006 authoritative entry and before floor derivation; never infer identity from a numeric range, chain order, or display title.
Reward comparison uses the existing semantic content package mapping; reward display strings are not grant identity. Do not create a new reward pack or idempotency namespace.
1006 has **no configured predecessor**: do not require 1005 completion, though normal native acceptance starts from genuine tutorial level 5.
An independently valid existing level-5 character is allowed to accept it without chain100 completion, exactly as configured.
A malformed/mismatched existing config fails closed; a deliberately partial test/dev catalog may omit 1006 and simply supplies no wall floor or wall reconciliation.

## 3. Authoritative fact and eligibility

Use the existing API-owned persisted facts adapter, or a compatible owned-building-only adapter:
`city_building b JOIN player_city c ON c.server_id=b.server_id AND c.city_id=b.city_id`,
filtered by authenticated `c.server_id` and `c.player_id`; `MAX(b.level)` for **building_cfg_id=7 >=1**.
This must be a completed durable building level, not a queue target, a hook payload, client count, city cache, or `player_city.wall_level` (which defaults to 1).
An upgrade in flight retains its previously completed level; wall 0→1 in queue does not qualify. A completed wall 1 upgrading to 2 still qualifies.
Do not require a new post-accept upgrade: an already-owned completed wall qualifies once acceptance and unlock gates hold.
Any currently owned city may supply the fact; wrong owner, wrong server, wall-level city metadata alone, and uncommitted work do not.
Ownership is defined at the committed server fact-read snapshot; later transfer does not erase an already durable achievement. This is not proof of who originally built the wall.

For a **new reward entitlement**, require an existing accepted row (`accepted_at != NULL`), state in_progress/claimable, exact config, configured prerequisite check (none), and persisted/effectively repaired pre-award player level >=5.
No row/unaccepted row cannot become claimable through a passive read or event. Unknown/invalid row states are errors, not a way to accept.
Events after committed building completion are hints to reread these facts, not evidence in their own right; lost hints are repaired by ordinary quest reads/claim/login reconciliation.
Public `ReportQuestProgress` remains unconditionally rejected for valid authenticated payloads. Never expose a v2 field or trust a client-provided progress/version.

## 4. Proof v2, narrowly bound to 1006

Reuse `player_quest.progress` JSON: `{ "count": 1, "server_verified_version": 2 }`.
Version 1 remains valid **only** for IDs1001–1005 with its existing meaning. Version 2 is valid **only** for ID1006 and this exact contract; it is not a general upgrade of every quest.
Normal v2 requires accepted_at. A distinct no-payout legacy variant is `{ "count": 1, "server_verified_version": 2, "legacy_no_payout_verified": true }`, valid only on completed1006; §5 controls its only producer.
Other versions, v1 on1006, v2 on another ID, malformed JSON, unknown proof fields, count !=1 with proof, normal v2 missing accepted_at, or proof on unaccepted/in_progress/invalid state must fail closed explicitly.
`legacy_no_payout_verified` must be absent except the exact true-valued v2/completed1006 variant; false/null/wrong types, use with v0/v1, or use on claimable state are invalid. This marker cannot authorize a fresh reward.
The server writes normal v2 only after ordinary accepted-row eligibility and the durable owned-wall fact pass. Count=1, v2, and claimable state are persisted together before a grant. Explicit legacy Claim verifies current level/wall under §5 and atomically adds the no-payout variant while retaining completed state; only then may it establish a floor.
A claimable v2 row does **not** raise level. An unverified completed row does **not** raise level.
Once durable v2 exists, later wall loss, city transfer, hook loss, restart, or stale reads do not erase it or require the wall again for legitimate claim/level recovery.

Add 1006-only DB row-lock/CAS monotonic merging; extend neither daily reset semantics nor general main/side rows.
Preserve v2, a true legacy_no_payout_verified marker, completed state, existing accepted/completed/reward-claimed timestamps, and max updated_at against stale writes; a proof forces count=1 even if an old untrusted count was huge.
Normal proof0→v2 writes require the locked current row to have accepted_at and remain in_progress/claimable; a pre-lock eligibility check is insufficient. If receipt recovery concurrently completed proof0, preserve that tombstone unchanged and allow only explicit Claim to add no-payout proof. Validate the merged row before commit. Stale Accept writes cannot manufacture accepted_at on a completed tombstone, including a NULL accepted_at. The no-payout variant requires a locked already-completed row and the dedicated explicit-Claim verification path; missing/unaccepted/noncompleted rows cannot acquire that variant through an UPSERT race.
No path creates or repairs missing accepted_at from historical completion/receipt. Receipt repair must commit/reread completed history before an explicit Claim may verify the separate no-payout achievement.
MemStore mirrors these invariants for tests; PG serialization, not only a process mutex, provides production correctness.
Reads validate both row proof shape and fixed config before using v2; persistence helpers must not silently drop unknown versions.

## 5. Legacy handling: preserve history, require an explicit new achievement

**Chosen compatibility policy:** old completed rows are conservative reward-consumed tombstones. Never reopen them or grant again, even if a matching receipt is absent.
This avoids inventing unpaid-reward compensation from ambiguous history; no refund/extra package is authorized.
Old count/state/timestamps are not achievement evidence. An explicit authenticated **ClaimQuestReward(1006)** may verify a current legitimate wall without regranting historical rewards.
This applies uniformly to unverified completed legacy rows whether accepted_at exists or is missing; passive reads do not newly enroll historical completions.

| Historical 1006 | Handling |
|---|---|
| in_progress/claimable, accepted_at present, no v2, no paid receipt | Check gates and current wall; persist normal v2 if met, then ordinary fixed-key claim may pay once. Old count alone does nothing. |
| in_progress/claimable with no accepted_at, no receipt | Fail closed: no grant, proof, floor, or accepted_at rewrite. Any repair is a separate future policy, not this card. |
| completed, no v2, with or without accepted_at | Keep completed and suppress grants forever. Only explicit Claim may freshly verify current level>=5 and current owned completed wall, then persist the no-payout v2 variant. Return AlreadyCompleted, no grant. |
| exact successful old receipt, noncompleted or missing row | Read-only receipt recovery may create/repair completed/payment history, preserving any prior accepted_at/v2 but manufacturing neither. No floor without v2. |
| v2 claimable + exact successful receipt | Repair completed retaining v2; floor6 is recoverable even if wall disappeared after proof. |
| valid normal/no-payout v2 completed | Never grant; derive/retry persisted floor6. Missing accepted_at is allowed only for the no-payout variant. |
| malformed or cross-ID proof / mismatched receipt | Explicit failure/diagnostic; no grant, replacement key, or floor from bad evidence. |

### 5.1 Explicit no-payout revalidation, not acceptance repair

Use existing Claim RPC only; **AcceptQuest behavior is unchanged**. No new RPC, synthetic acceptance, progress reset, or enrollment button.
For a validated completed1006 proof0 row, an explicit authenticated Claim may check the exact config, independently persisted/repaired pre-award level>=5, and current owned durable cfg7 wall>=1.
Before creating this new no-payout proof on completed proof0, validate any existing exact1006 receipt: absence is allowed, but a mismatch or reader failure must fail explicitly. Already-valid completed v2 needs no renewed receipt/fact check.
When met, atomically persist count1/version2/legacy_no_payout_verified=true on that completed row. Preserve accepted_at including NULL, state, completed_at and reward_claimed_at; do not create or alter payment history.
When fact/gate is unmet, leave the old completed row without proof and return AlreadyCompleted; DB/fact/parse/write errors stay explicit rather than falsely reporting a new verified result.
This permission is a current **no-payout achievement verification** on an explicit user action, not proof of historical acceptance or historical construction.
If the same explicit Claim first recovers a matching paid receipt into completed state, it may then perform this current verification after rereading the committed completed row. Receipt alone cannot satisfy the wall or unlock checks.
Ordinary reads/login may repair receipts and derive level from already-persisted v2 but **must never create the legacy no-payout variant**, even if a wall currently exists.
The no-payout flag stays monotonic and its completed-state invariant makes it permanently ineligible for a new grant. Concurrent/stale normal writes cannot erase or downgrade it.
Existing ContentPanels already permits selecting1006 and invoking Claim even when completed; no new API/UI flow is needed. The existing error/reentry hint should include1006, because AlreadyCompleted carries no authoritative level scalar.
After a successful current verification that returned AlreadyCompleted, reenter/login retrieves PlayerProfile level6; the client must not infer6 from that error or append rewards.
Malformed noncompleted legacy rows without acceptance remain explicitly outside automatic repair. This bounded residual gap is safer than silently rewriting history.

## 6. Exact payment recovery and interruption semantics

Keep the existing key `quest:<player_id>:1006:claim`, server-namespaced by CONTENT. Never add v2 to the reward key.
Use existing `RewardReceiptReader` and `ContentGranter.FindQuestRewardReceipt` read-only. Match authenticated server/player, exact fixed key, successful status, positive real grant ID, and exact canonical wood800/item2018×1 package.
Receipt lookup errors/mismatch are not “absent”; no Grant probe, no alternative key, no replacement bundle.
Receipt is evidence of payment only, never evidence of wall achievement or acceptance.

Every producer of new normal v2, including post-Accept reconciliation, building hooks, passive reads and Claim, must use the same receipt-first coordinator: exact receipt lookup, paid-history repair and committed reread, then eligible unpaid noncompleted fact verification. Already durable v2 requires no renewed wall proof. The pure floor/provider does not invoke this coordinator.

Claim order for 1006 (separate from phase-1 behavior):
1. Read/validate row/config. A completed row remains nonpayable; before NEW no-payout proof, explicit Claim validates any existing exact receipt (absence allowed, mismatch/error fails), then applies §5 verification, API level recovery and existing AlreadyCompleted behavior. Already-valid completed v2 remains sufficient.
2. For noncompleted/missing state, query exact receipt **before** attempting new entitlement verification. Reread row after receipt IO to avoid a racing claimant's stale snapshot.
3. If paid: preserve v2 if present and restore completed/claim history only; never call Grant. Missing acceptance stays missing. After the history write/reread, this explicit Claim may verify current no-payout proof under §5; receipt itself supplies neither wall fact nor proof.
4. If absent: require accepted/state/gates, reconcile current facts if necessary, persist v2, then reread validated claimable v2. Only then call existing fixed-key atomic Grant.
5. After successful Grant, persist completed/claimed state preserving proof, reread durable result, then ask API to persist floor. Concurrent calls may reach Grant, but CONTENT's fixed successful key grants at most once.
6. Failure before grant: no reward and no floor. Grant success + completion-write failure: next claim or ordinary recovery uses the exact receipt without granting again. Completion success + level-write failure: next login/read/repeated claim derives floor, with no new payment.

Add a **1006-only read-side recovery** method used by login/enter-server and ordinary task/chain reads: validate row; reconcile an exact successful receipt when needed; reconcile eligible accepted **noncompleted** current wall facts; never accept, create legacy no-payout proof, or call Grant.
It must also handle an exact paid receipt with no quest row, preserving absence of acceptance/proof. Receipt recovery alone leaves floor<=5 unless an existing higher level already exists.
A missing receipt and unmet fact/gate are ordinary “not yet verified” outcomes, not fabricated success; DB/parse/receipt mismatch errors remain explicit.
Do not advertise old unverified claimable counts as new verified progress: a 1006-only safe view may project noncompleted proof0 as in_progress/count0 while keeping raw legacy history until validation. Completed history remains completed.
No SQL/admin batch backfill of proof or floor; ordinary scoped server paths are the migration.

## 7. Player-level derivation and API ordering

Keep `CompletedTutorialLevel` behavior unchanged, including its existing legacy-completed compatibility and max5.
Add a separate pure fixed-1006 proof-aware floor calculation: valid exact config + state completed + either (normal v2 with accepted_at) or (valid no-payout v2 variant) =>6, otherwise no wall contribution.
Combined floor is `max(phase1_floor, wall_floor)`; it is bounded1..6 and **not** `MAX(sort)` or the highest completed quest ID.
The pure derivation reads validated durable state only; it must not invoke fact reconciliation, receipt IO, checkUnlock, or level-provider callbacks.
API persists `GREATEST(level, combined_floor)` scoped to existing authenticated server/player and returns the actually persisted value; no actor insertion, no false level1 on read errors.

Avoid recursion: unlock provider calls only the pure derivation+level persistence path. Entry/read recovery orchestration invokes wall recovery **outside** that provider, then derives/persists the combined floor.
This ensures level>=5 is established independently **before** granting new v2; proof cannot bootstrap its own unlock from an old completed row.
Run read-side recovery before the final level refresh in login/enter-server and list/chain handlers; reconcile and persist again after proof/completion changes so the response is not one read behind.
Claim success returns existing `ClaimQuestRewardResponse.player_level=4` only after durable level success. On level failure return existing error behavior; reward may already be committed and must not be retried with a new key.
Repeated completed claims can repair level then return AlreadyCompleted; the error carries no new authoritative level. Reentry/login returns current PlayerProfile.
Client uses same-actor/session-generation guarded positive scalar max-update; zero means unknown. Never infer6 from quest1006, text, receipt, completed state, or local counters.
Client must not add `granted_rewards` to local assets; use guarded authoritative bag/wallet replacement. Extend existing profile-reentry failure hint to1006, without changing1001–1005 semantics.
No wire/schema addition is necessary: JSON progress already exists and field4 already exists. If implementation discovers a truly unavoidable schema need, stop for a separate contract PR; do not expand this card silently.

## 8. Release/rollback and bounded domain cards

All cards require review, explicit allowed files, domain tests, documentation, and **<=400 changed lines including tests**; split at domain/subsystem boundaries if necessary. IDs below identify separate implementation cards; only orchestrator edits backlog.
No card may alter canonical DATA-002 files, reference/art hold branches, paid purchases, credentials, or another active verification database. Contract review alone does not activate runtime behavior.

| Proposed card | Scope and deliverable | Dependency / decisive tests |
|---|---|---|
| SPEC-WALL-001 | `spec/rules/onboarding_wall.md` only: reviewed contract; note phase1 remains unchanged. No DB/proto modifications. | Independent contract approval first; explicitly call out new policy and explicit no-payout revalidation. |
| QUEST-WALL-PERSIST | `internal/quest/{proof,types,pg_store,mem_store,store}.go` (store.go only for a dedicated transition port) plus focused domain tests/docs: allow only v2/1006; exact monotonic persistence, distinct no-payout marker validation; never rewrite acceptance. | SPEC; malformed/cross-ID/version matrix; actual PG stale/concurrent write race; v1/daily regression. Split PG tests if >400. |
| QUEST-WALL-VERIFY | New `internal/quest/wall*.go` and minimal service dispatch/read wiring, domain tests/docs: exact config, accepted fact reconcile, pure wall floor, dedicated explicit-Claim no-payout verifier. | PERSIST; no autoaccept; gates/current wall vs cache; accepted-before/after-action; old completed without proof never floor. |
| QUEST-WALL-CLAIM | `internal/quest/claim_wall*.go`, minimal claim dispatch, domain tests/docs: fixed-key receipt-first claim and read-only recovery, no-regrant legacy policy. | VERIFY; spy granter proves zero calls in receipt/completed recovery; paid/missing-row, failures, concurrent claims. Split PG fault tests if >400. |
| API-WALL-LEVEL | `internal/api/{quest_level,quest_handlers,quest_progress_hook}.go` and new API-only wall helpers/tests/docs: combined pure floor, pre/post recovery orchestration, login/entry/list/chain/claim wiring, and1006-specific post-committed-building/speedup hints using the existing facts adapter (do not widen ReconcileTutorial or daily events). | All QUEST cards; no recursion; actor/server ownership; DB-write failure/actual returned level; public Report still denied; phase1 unchanged. Split handler wiring from PG tests if needed. |
| CLIENT-WALL-RECOVERY | `client/src/net/questClaimAssets*`, narrowly related content-panel files/new helper and tests: include1006 in existing reentry hint and verify existing explicit Claim access for completed1006; no new acceptance flow or optimistic reward/level changes. | API; actor switches, delayed results, repeated clicks/errors, unknown level, existing1001–1005 behavior. |
| INTG-WALL-NATIVE | Separate test evidence/scripts only, outside active frozen verification. Separate natural run and injected fault fixtures. | Approved integrated SHA; native sequence below, restart/reads, unchanged hash/receipt checks. Not a runtime domain patch. |

A new SQL table, schema migration, event ledger, general main-quest engine, or protocol field is **not needed** for this state-based wall slice.
Fully quiesce all old quest-writing instances, including in-flight claims, grants and asynchronous continuations, before enabling v2. Only the new proof-first path may produce `quest:<player_id>:1006:claim`; concurrent legacy imports/writers are unsupported. A competing new successful grant follows durable v2, so locked re-read preserves that proof/completion. Without this activation fence, current ports cannot guarantee receipt-versus-proof ordering and a shared cross-domain serialization contract is required. Old code rejects v2 and can overwrite1006 rows with generic writes; mixed old/new writers are unsafe.
Rollback must retain a v2-aware reader/writer and authoritative gates, or disable affected quest write paths; never roll back to arbitrary Report or generic1006 payout. Keep proof, paid history, and achieved levels; no rollback downgrades.

## 9. Acceptance — native play and separate fault matrix

### Natural private continuation (no fixtures masquerading as play)

- Use a **new/private** database and actor with a recorded genuine1001–1005 native run to persisted level5, or continue its separately retained private natural actor. Never use or mutate another active verification database.
- Record integrated SHA, actor/server (redacted appropriately), config hashes, genuine level5/quest1006 acceptance, and initial completed wall level0/absence. Do not use GM, SQL writes, resource/progress/level seeds, fake Report, fake clock, or debug completion endpoints.
- If hall<3, pay its existing canonical upgrade cost and wait real server duration first. Wall1 currently requires completed hall3; no prerequisite shortcut.
- Through normal UI/RPC, start cfg7 wall0→1 in the canonical wall slot, pay **food100 + wood100 + stone300 + iron150**, wait **120 real seconds**, and settle normally. Insufficient resources must be obtained through authorized normal existing gameplay/production, not injected.
- During queue:1006 not verified/claimable and player still5. A default `player_city.wall_level=1` never satisfies it. Record real debit and queued/committed states separately.
- After durable completion: ordinary task refresh shows1006 claimable with v2 persisted; before claim player still5. Claim once: exact wood800 + item2018×1, completed1006, persisted player6, response field4=6, correct UI after guarded refresh.
- Compare receipt contents and bag delta; account for independently earned timed production when comparing wallet totals instead of misreporting a raw wallet delta as the quest grant.
- Restart the private server/process and reenter: completed1006/v2, one successful fixed receipt, same reward quantities, level6; repeated claim gives AlreadyCompleted and no grant/double UI assets.
- Native action-before-accept coverage may use a separate genuine actor; no duplicate grant and no queue-target credit.

### Isolated deterministic fixtures (never counted as native acceptance)

- Pause normal verification while receipt recovery completes proof0: locked verifier must not create normal proof/floor. Race stale Accept against a receipt-created completed row: no acceptance is manufactured.
- Pause after absent receipt lookup; a competing new claimant persists v2 and grants; locked verifier must preserve current proof/completion.
- Completed legacy row plus current wall through every passive hook/read must never gain no-payout proof.

- Full legacy table in §5; especially old completed/old receipt/no wall/no v2 => no6, and old completed+current wall (including missing acceptance) => no6 until explicit Claim freshly verifies no-payout proof.
- Explicit Claim on legacy completed + current real wall + level5 => no-payout v2/6 without any Grant call, preserving accepted_at including NULL; completed without receipt still never regrants.
- Exact receipt missing row restores history only; later explicit Claim/current wall can earn6 without changing receipt count or inventing accepted_at. Wrong owner/server/key/status/reward or reader failure does not grant or floor.
- v2 claimable + crash after successful grant/before quest completion => receipt-only completion repair even after wall loss; crash after completed/before level UPDATE => login/read recovers6.
- Failed receipt/state/proof/level writes; response loss; separate-process restart; duplicate/concurrent accept/reconcile/claim; late stale UPSERT; two-server/same numeric actor isolation.
- Wrong-owner city, wrong-server building, queued wall1, wall metadata default1, missing wall row, malformed/future proof, proof1 on1006, proof2 on1005/1007, invalid accepted state, huge old counts, and absent/mutated config all fail closed.
- New reward claim requires independently established level>=5; no circular floor recovery. Already20 stays20; v2 claimable stays<=5 unless the character already had a higher persisted level.
- Existing chain100 compatibility/receipt/starter tests and trusted daily reset/event tests continue passing; public Report negatives still pass.
- Claim response/relogin same-actor authority, unknown/zerolevel, stale account response, interrupted explicit no-payout verification, close/back/reentry, and bag/wallet snapshot replacement tested in client.
- Independently verify1007 acceptance at6 when1006 completed and1009 head acceptance at6; **their progress remains unchanged**. Also preserve and regression-test existing unlock6 gates1014 (daily_train_1) and1018 (side_scout), including existing daily1014 behavior. Do not claim newly implemented progress or rewards for these collateral gates.

## 10. What remains deliberately unresolved

Level6 opens existing gates1007,1009,1014 (daily_train_1) and1018 (side_scout) as an unavoidable consequence of the chosen new floor, not a newly implemented completion path.
1007+ building-objective hooks/proofs are still out of scope;1008(level8),1010(level8),1011(level9) have no new natural level8/9 route here.
Chain300 still lacks a specified durable cumulative training/recruitment ledger, acquisition-source/backfill policy, event identity/dedup, and enqueue-vs-completion semantics.
Owned hero count does **not** prove cumulative recruitment; current troops or transient training queues do **not** prove cumulative trained totals.
Post-action callbacks may be lost. This slice repairs **state-based wall** evidence from durable buildings; it does not solve general durable-event loss, lifetime history, or all DATA-002 quests.
No full DATA-002 completion, general progression, or production acceptance claim is warranted by this design.
