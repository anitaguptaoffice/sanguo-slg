# SPEC-HOTEL-TX — local transaction contract proposal

Revision 2 (coordinated activation; sibling-family and metadata prerequisites).
Date: 2026-10-25. Source audit: `verify-takeover-local` HEAD
`799e1998d84610291b0bbcad7a108439f728ac7d`; candidate sequence contract
`2786fb31659085a8ba9a3bc48909c67209a4c37b` independently approved locally.
Independent spec/rules-only card based on local integration `28571b53a185d173ecfef1e3fa95c7be33b9a4b9`.
Substantive design reviewed locally; domain implementation and release require separate cards.
No runtime/production mutation, publication, new gameplay, costs, attributes, pools, DATA-002,
SKU/IAP, RPC or request key is authorized. This is not a safety claim about present code.

## 1. Observed boundaries and exact promise

Source observations, not newly reproduced transaction exploits:

| Source | Current boundary / consequence |
|---|---|
| `hero/hotel_pg_store.go:NextCandidateID` | MAX+1 repeats within a generated batch; sequence consumer is a separate approved follow-on. |
| `hero/hotel.go:SyncHotelPool` | Reads rows/tick outside replacement; replacement and tick commit separately. |
| `hero/hotel_pg_store.go:ReplaceCandidates` | Own transaction covers DELETE+INSERT only; does not serialize the preceding snapshot or missing/empty pool. |
| `hero/hotel.go:RefreshHotelPoolPaid` | Item debit precedes independent replacement/tick; failure can retain debit. |
| `hero/hotel.go:RecruitHotelCandidate` | Capacity read, gold spend, hero insert, candidate delete are separate; duplicate concurrent recruitment/capacity race/partial assets are possible. |
| `hero/hotel_pg_store.go:DeleteCandidate` | Missing candidate deletion returns nil; no exactly-one consumption requirement. |
| `api/hero_hotel_handlers.go` / `hero_hotel_city.go` | Session/shard checked, requested city owner not checked; building query uses server/city only. |
| `api/hero_city_ownership.go:playerOwnsCity` | Existing helper relies on city cache/LoadCity and is not a transaction-bound ownership proof. Do not reuse it as such. |
| `api/hero_recruit_tx.go` | Natural recruitment already holds wallet, then items, then inserts hero in one transaction. No natural-recruit office capacity rule exists. |
| `content/item_tx.go` | Existing supplied-tx item debit locks wallet then sorted items; no cache publication/commit. |
| `domestic/pg_store.go` / `production_store.go` | Durable building writes hold wallet then city/owner SHARE, checkpoint, buildings. Hub lock is acquired before wallet. |
| `hero/coming.go`, `captive.go`, `persuade.go` | Coming acceptance, captive summon and lionize hire check capacity without holding a shared wallet lock through the owned-count change. |

Required outcome: each listed hotel operation observes one authorized, serialized city/player
state and has one commit decision. A failed transaction cannot leave only its debit, candidate
replacement/consumption, tick or newly owned hero committed. Sequence gaps remain acceptable.
This contract does not make old coming/captive/lionize multi-step operations atomic by assertion.
Their compatible family-wide replacements are part of the coordinated activation prerequisite,
not an option to disable existing gameplay or ship a mixed old/new writer combination.

## 2. Preserve current rules exactly

- Actor server/player/account comes from the authenticated session; reject nonpositive city and
  candidate IDs, shard mismatch, absent actor and unowned/missing city. Client cannot supply cost,
  attributes, generated identity, hotel/office level, clock, random seed or authoritative balances.
- Read hotel/office levels from persisted city buildings inside the authorized transaction.
  No hotel => existing not-built result. Keep current building cfg IDs and level aggregation.
- Pool sync keeps the current block formula, +8-hour offset, oldest ordering
  `(generated_at,candidate_id)`, delta-based eviction and fill-to-hotel-level behavior.
  Preserve delta<=0/fill behavior and when tick does/does not advance; do not invent a new reset.
- Paid refresh consumes exactly existing `HotelRefreshItemCfgID`, quantity 1, and regenerates
  using the current generator/level/attributes/gold-cost formula. No new fee or reward.
- Recruitment selects the exact persisted `(server,city,candidate)` row; its GoldCost and
  attributes are authoritative. Nonnegative cost validation prevents negative debit/credit;
  do not invent a different price. Zero, if legitimately persisted, still takes serialization locks.
- Keep existing `HasHeroCapacity(officeLevel, CountOwnedHeroes(...))`: count the player's heroes
  across cities, excluding Coming/Captive. Do not silently change this to a per-city count.
- Recruitment does NOT implicitly sync or expire a candidate: the existing recruit path does
  neither. Only list-triggered sync and refresh alter expiry/selection under their existing rules.
- Newly recruited hero keeps template 0, candidate name/level/loyalty/attributes and idle status,
  but receives a new `player_hero_id_seq` ID. Candidate ID never becomes hero ID.
- Natural template/scroll recruitment keeps its existing lack of office-capacity gating.
  Consequently this work does NOT promise a universal owned-count <= office-level invariant.

## 3. One transaction owner and a compatible lock order

API coordinator owns READ COMMITTED Begin/Commit and cancellation-safe deferred rollback.
Every participant uses only that same pgx.Tx. No nested Begin, Pool queries, runtime DDL,
GRANT, implicit fallback, self-committing Spend/Remove/CreateHero, or Hub mutation in transaction.
Private wiring binds WORLD/DOM/HERO/CONTENT capabilities to the exact API pool/schema; nil,
wrong shard, rewired/memory-only or distinct-pool capabilities fail closed before asset writes.

All three hotel routes, including list because it mutates, take this order:

1. Authenticate/lock existing `player` actor row for KEY SHARE; validate account if supplied.
2. Lock existing `player_wallet(server,player)` FOR UPDATE. No wallet creation/bootstrap,
   credit or fee on a read; missing initialized wallet is unavailable, not silently healed.
   This is the existing player serialization point shared with natural recruit, content and DOM.
3. WORLD-owned port locks `player_city(server,city)` FOR UPDATE and checks player_id.
   This holds ownership stable even against an ordinary SQL owner update. FOR KEY SHARE is
   insufficient because owner is not the primary key. Unauthorized request rolls back everything.
4. DOM-owned supplied-tx port reads committed hotel/office building levels. No Hub lock/load/save.
   Existing durable DOM writers share the wallet lock, including delete/reinsert building saves.
5. If an operation needs items, acquire/debit them through CONTENT in ascending item ID order.
   CONTENT's repeated acquisition of the same wallet is harmless; never enter it from an
   operation that first acquired candidate/hero locks without already owning wallet/items.
6. HERO reads/locks pool candidates and schedule using tx; candidate rows in ascending ID order
   when taking multiple row locks. The existing locked city row is the stable empty-pool mutex:
   no reliance on locking zero candidate rows or an absent schedule row; no new mutex table.
7. HERO creates/consumes rows and saves tick using tx; commit is the API owner's sole decision.

Thus wallet -> items -> candidates remains the asset-lock order; the city authorization lock
sits after wallet and before items. No hotel operation holds city/candidate locks then waits
for a wallet. A future multi-player/city operation must lock wallets then cities in canonical
(server,ID) order or stay gated pending review; this draft does not authorize such a feature.

Do not take the DOM Hub mutex, content Service cache mutex or external callback while waiting
inside the database transaction. Current DOM writer order is Hub -> wallet; taking Hub while
holding wallet would introduce a cycle. Post-commit cache work happens after database locks end.
Service random draws use the already approved concurrency-safe HERO random wrapper; do not
hold its mutex across database operations or introduce client-controlled randomness.

## 4. List-triggered sync, paid refresh and recruitment

### A. List-triggered sync

After steps 1–4 and common pool lock, read rows and tick in tx. Capture server time once after
lock acquisition. HERO pure planning computes retained/new rows and whether tick advances.
Reserve each new candidate ID from the dedicated candidate sequence through the supplied tx;
replacement of the planned pool and tick update occur in the same transaction. For no mutation,
return the locked snapshot without allocating IDs or changing tick. Commit before responding.
Response candidates/levels/owned-count derive from that transaction, not an unlocked later read.
Set response hero_owned to CountOwnedHeroes(txRows), excluding Coming/Captive exactly like the
capacity gate; current ListPlayerHeroes.Total includes Coming and can falsely show a full office.
Do not preserve that display bug or add a different counting rule.
A later refresh may invalidate this response legitimately; stale candidate recruitment must reject.

### B. Paid refresh

After actor/wallet/owner/building validation, debit exactly one existing refresh item via CONTENT;
then read/replace candidates and save tick through HERO using the common city mutex and same tx.
Return the new pool snapshot only after confirmed commit. Any generation, allocation, insert,
tick, cancellation or commit-abort failure rolls back the item and entire pool/tick replacement.
No separate pre-spend, compensation, refund or retry. Distinct confirmed refresh requests may
both succeed/consume items; absence of a persistent request key forbids an exactly-once claim.

### C. Recruit selected candidate

After actor/wallet/owner/building validation, read owned heroes inside the wallet-locked tx;
apply the unchanged office-capacity rule. Read/lock the requested candidate in the same city.
Missing candidate fails before debit. Compute a disposable hero draft from that row.
API gold participant performs a conditional `gold = gold - cost` update against the locked
wallet and requires exactly one affected row; preserve food/wood/stone/iron. Never use cached gold.
HERO consumes exactly one candidate using tx (DELETE ... RETURNING or checked affected count)
and inserts the new hero using existing CreateHeroInTx. Either order is acceptable inside this
single transaction, but failure of either aborts all effects; never return success on zero consume.
Do not change the schedule or refill the hole during recruit; that is the subsequent list behavior.
Only after Commit may API return the assigned hero ID and send the existing quest signal.

## 5. Capacity and sibling-family compatibility are coordinated prerequisites

The shared wallet correctly orders hotel recruitment against the current natural API coordinator,
which reads/inserts under that wallet. It does NOT alone fix other existing count-increasing writers.

Before coordinated activation, every online path changing CountOwnedHeroes
must hold the same player's wallet from its authoritative capacity/ownership read through commit:
- Other hotel candidates, including requests to different cities of the same player.
- Coming -> idle acceptance, captive -> idle summon, lionize hire.
- Any other proven online count-increasing writer discovered by the activation inventory.
  Inventory/hero standalone convenience methods are not substitute coordination.

RecruitPlayer and RecruitAndPersist already reject non-MemStore backends with
ErrRecruitTransactionRequired; they are PG-closed, not known live bypasses. Preserve that closure.
GM/import/injection/owner-transfer paths are inventory and maintenance conditions, not proven
online routes in this audit. If an authorized deployment exposes them, record the actual call
path and coordinate its relevant writes; do not infer a live feature or implement a new one.

For paths with an existing capacity rule, preserve that rule under the lock. For natural recruit,
retain its rule of no capacity gate; it may legally add after a hotel operation. Coming/captive
injection creates excluded statuses, so injection alone does not consume owned capacity; later
acceptance/summon does. Count-reducing delete can be serialized conservatively but cannot be used
to justify unprotected count-increasing paths. Owner transfers need both affected wallets.

All conflicting family mutators must participate, not only count-increasing entry points:
- Coming: acceptance and RejectComing lock/recheck the same hero/metadata under the wallet;
  accept atomically changes status and consumes metadata; reject atomically consumes offer and
  deletes that still-coming hero. Losing operation returns existing state error, never deletes an
  accepted hero or restores deleted metadata. If authorized injection is included in the writer
  inventory, its hero and metadata must commit together; source currently labels injection GM/tests.
- Captive: SureSummon, ReleaseCaptive and TrySummon (which currently persists inferred item
  requirements) share wallet/hero/metadata serialization. A preview may become stale, but cannot
  recreate metadata after release or overwrite a completed summon; summon re-derives/rechecks
  existing requirements, then commits gold/items/status/metadata together. Release cannot delete
  an already-summoned owned hero. Inventoried injection likewise creates hero+metadata atomically
  with current values; this does not assert an online injection route exists.
- Lionize: befriending, PersuadeHero and hire all serialize the same progress row, including its
  initial absence, under wallet. Befriend gold+state, persuade item+friend/cooldown and hire
  hero+recruited state each commit atomically. Stale persuade/befriend must not overwrite terminal
  recruited state; repeated hire cannot duplicate hero/charge or erase state. Preserve all current
  eligibility, fee, item, friend-cap, cooldown, template and office-capacity rules.

Capacity check and the terminal-state recheck both occur under locks; wrapping only the final
SaveHero/CreateHero or only debit is insufficient. Shared-wallet ordering handles absent progress
rows without new mutex tables. After item locks, lock owned hero rows in hero-ID order then its
family metadata; a participant must not acquire item locks later. Plan required item IDs from
wallet-protected authoritative state before this final row-lock phase. All family writers follow
this order, including reject/release/preview. No cached precheck is authoritative.

No independent list/refresh activation while old recruit/delete/refresh writers remain: old
recruit can ignore the city mutex and consume rows read by a new sync; stale replacement can
then resurrect them. API list/refresh/recruit and family-compatible replacements must be reviewed,
integrated and activated as one compatible writer set. No existing gameplay route is disabled
as a substitute fix. Deployment drain is a bounded authorized upgrade step, not feature removal.

### 5.1 Existing metadata schema is a separate prerequisite contract

Current stores create these tables lazily with runtime CREATE TABLE IF NOT EXISTS:
- `coming_store.go:playerHeroComingDDL`: player_hero_coming(server_id INT, hero_id BIGINT,
  city_id BIGINT), all NOT NULL; PK(server_id,hero_id).
- `captive_store.go:playerHeroCaptiveDDL`: player_hero_captive adds summon_item_cfg_id INT and
  summon_item_qty INT, both NOT NULL DEFAULT 0; same PK and nonnull server/hero/city fields.
- `persuade_store.go:playerHeroLionizeDDL`: server_id INT, player_id BIGINT, npc_cfg_id INT,
  friend INT DEFAULT 0, state SMALLINT DEFAULT 0 (all NOT NULL), nullable last_persuade_at
  TIMESTAMPTZ; PK(server_id,player_id,npc_cfg_id).

Before no-DDL transaction participants consume these, a separate SPEC-HERO-METADATA-SCHEMA
card must inventory and formally migrate exactly the existing shapes, defaults and keys. It must
handle fresh/previously-created tables, validate existing shape, replay/ledger failure and schema
isolation without dropping/recreating data, silently changing columns, new fees/states/FKs or
inventing missing metadata. Existing orphan/inconsistent records require explicit audit, not a
request-time repair guess. Review the optional-reference treatment in hero ID migration as well.
Only after contract approval/local integration may HERO replace lazy ensure-DDL consumers and
add tx-only metadata ports. This draft neither executes nor authorizes that production migration.

## 6. Required domain ports (names illustrative, semantics mandatory)

| Domain | Bounded capability |
|---|---|
| WORLD | Lock/check `(server,city,owner)` in caller tx, holding city FOR UPDATE; no Pool/lifecycle/cache. |
| DOM | Read persisted hotel/office levels in caller tx after wallet/city locks; immutable pool/shard provenance; no Hub acquisition. |
| HERO | Pure hotel and sibling-family plans; tx-only pool/tick/reservation/replace/exact consume plus hero/metadata lock, conditional transition/delete and progress update; existing hero tx read/create reused. |
| CONTENT | Existing DebitItemsInTx and post-commit InvalidatePlayerContext; existing approved shared wallet/item guarantees, not self-committing Remove. |
| API | Actor/wallet SQL and gold conditional debit, immutable same-pool wiring, transaction lifecycle, mapping, post-commit notification/cache policy. |

API does not copy HERO candidate/hero or CONTENT inventory SQL. HERO does not touch wallet,
items, world ownership or buildings. WORLD/DOM owners provide their own reads/locks. No proto changes are proposed. The separate
existing-shape metadata schema contract above is required in addition to the candidate sequence.
Legacy PG multi-step hotel service entry points must fail closed or become unreachable under
verified production wiring; retaining them as a fallback defeats the contract. Pure memory tests
can retain explicit non-production semantics, not masquerade as transactional PG guarantees.

## 7. Failure, unknown commit and presentation

- Before confirmed commit: no success response, provisional ID, content/cache publication or quest event.
  On ordinary error/known rollback, all asset/pool/tick writes disappear; sequence gaps may remain.
- Commit error is not proof of rollback. Log actor/city/candidate/operation and private diagnostics;
  return existing unavailable/internal status with sanitized “outcome unavailable; reload state”.
  No automatic replay, compensation, extra debit, refund, alternate-ID retry or transaction fallback.
- Without a request ledger or candidate->hero receipt, candidate absence cannot prove this request
  succeeded: another refresh/recruit may have removed it. Reload durable hero/wallet/bag state;
  do not infer a specific hero from matching random attributes. Exact unknown-outcome attribution
  requires a separately approved receipt/idempotency contract, not an invented trace-id guarantee.
- Current list RPC can mutate by syncing. Do not label calling it a read-only recovery probe or use
  its later candidate absence as evidence of the prior commit. Bag recovery may trigger existing
  starter-grant logic, so it too is not a purely observational proof. Refreshed hero/wallet/bag
  responses show current state subject to those established effects, not an exact lost receipt.
- Confirmed commit remains success if post-commit cache refresh, list refresh or quest delivery fails.
  Invalidate/re-read caches rather than publish stale absolute snapshots; report post-commit failures
  diagnostically. Existing quest signal remains best effort; this does not add an outbox guarantee.
- Client must not auto-resubmit after timeout; retain current no-network-auto-retry behavior.
  A required CLIENT-HOTEL-OUTCOME card must distinguish confirmed purchase from subsequent
  reload failure and show recovery guidance for unknown outcome, without claiming “not charged”
  or adding a new RPC. Current recruit-success then list-refresh share one catch, incorrectly
  hiding confirmed success on reload failure, while timeout text is raw; this is not optional.
- Existing client int64 decoder fails closed above Number.MAX_SAFE_INTEGER. A restored reservation
  outside supported client range needs a separately reviewed client compatibility fix before enabling
  that deployment; do not lower/recycle sequence IDs or silently truncate them as a workaround.

## 8. Minimal implementable local stages and required evidence

Each stage is an independent scoped card/review, <=400 changed lines; split implementation/tests
when needed. Card labels are proposals, not backlog edits or authorization.

1. SPEC-HOTEL-CANDIDATE-ID + HERO-HOTEL-CANDIDATE-ID: approved sequence contract then consumer.
   Evidence: real PG multi-ID batches/stores/shards/deletion/reconnect/restart, missing/exhausted
   sequence fail closed, unchanged original hotel test and unfiltered HERO PG suite. No activation.
2. SPEC-HOTEL-TX: review this revised coordinated contract, family-wide writer inventory,
   owner/domain port scope and lock order. No runtime implementation before approval.
   SPEC-HERO-METADATA-SCHEMA is a separate reviewed existing-shape migration prerequisite
   before no-DDL sibling ports; fresh/existing/shape/replay/isolation tests are mandatory.
3. WORLD-HOTEL-OWNER-TX + DOM-HOTEL-LEVEL-TX: owner/building capabilities in their own domains.
   Evidence: wrong owner/shard/missing rows, owner update blocks, tx-only use, no Pool/Hub/lifecycle.
4. HERO-HOTEL-TX-PORTS + HERO-HOTEL-PLANS: transaction participants and unchanged pure rules.
   Evidence: empty/missing schedule, boundary tick/no-tick, exact consume, supplied-tx rollback,
   zero standalone Pool access, no generated-ID reuse, invalid dependencies fail closed.
5. API-HOTEL-POOL-TX: actual production list/paid refresh coordinator/wiring; no old fallback.
   Evidence: concurrent first list/refresh, list vs refresh/consume, no overfill/resurrection/tick
   double-advance, item only sufficient once, all rollback stages, no unauthorized side effects.
6. Separate HERO family ports/plans and API COMING-TX, CAPTIVE-TX, LIONIZE-TX coordinator
   cards, plus API-HOTEL-RECRUIT-TX; all are existing concurrency repairs, not new rules.
   Evidence: accept vs reject; summon vs release/TrySummon; persuade/befriend vs hire;
   inventoried injection metadata rollback; terminal state never regresses; no double fee or partial
   hero/metadata. Preserve PG closure of the old RecruitPlayer/RecruitAndPersist convenience paths.
   Also same candidate once, one remaining capacity across cities, hotel vs natural ordering,
   exact gold/hero/candidate deltas at all failure stages. No partial family activation.
7. API-HOTEL-TX-VERIFY + required CLIENT-HOTEL-OUTCOME.
   Evidence: actual production adapters, two independent API instances/pools/services, restart;
   confirmed commit followed by cache failure; injected lost commit response; no auto replay;
   canceled/failed transaction; absent/rewired participants; sanitized errors; unauthorized list;
   hero_owned excludes Coming/Captive; committed recruit plus failed reload remains success;
   timeout guidance does not claim rollback, and recovery views are not treated as receipts.
8. Separately authorized coordinated release: replace the complete compatible hotel/family
   writer set; bounded upgrade drain, role/schema/sequence/client-range checks, integration
   tests and observed rollout. Do not disable existing gameplay as the repair strategy.
   No staging combination or unit-test pass is itself permission to enable hotel writes.

All tests use disposable, TCP-only PostgreSQL and shared cache, with owned process cleanup.
Run race tests plus actual unfiltered HERO/API PG suites; do not filter out legacy failures,
substitute a fake SpendGold adapter for API production wiring, or claim this design is implemented.
