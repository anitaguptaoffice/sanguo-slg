# API family transaction replacement (local, coordinated release only)

Base: reviewed composed `d44d0ec45199d732128252734f8dd2e74c12fb24`.
Contract: `spec/rules/hotel_transactions.md` and
`internal/hero/FAMILY_TRANSACTIONS.md`; no protocol or gameplay rule changes.
This implementation replaces existing API routes locally. It is not permission
for partial deployment, a new injection/import feature, or a gameplay toggle.

## Boundary and ordering

`WireM4Content` privately binds real coming/captive/lionize PG metadata adapters
to the existing hotel capability set and exact API pool. Each request checks
exposed service/store identities, pool provenance, DOM shard, session/payload
shards, actual actor/account and an initialized wallet. No bootstrap on reads.
All routes use one READ COMMITTED transaction with cancellation-safe rollback.

1. Actor KEY SHARE, then the existing wallet FOR UPDATE.
2. For coming/captive, nonlocking wallet-protected hero/metadata discovery
   resolves omitted city 0; requested positive city must match the offer.
3. WORLD owner FOR UPDATE, then DOM persisted office level where capacity applies.
   Lists authorize all discovered metadata cities in ascending city-ID order.
4. HERO preliminary item plan; CONTENT authoritative bag and sorted item locks.
   Item insufficiency precedes gold insufficiency, as in the existing rule.
5. HERO cross-city rows lock in hero-ID order, then final metadata locks.
6. Locked replan; verify the planned item/gold debit agrees. Exact metadata is
   consumed BEFORE coming/captive status/deletion. Lionize progress uses CAS,
   including insert-only initial befriending and terminal-state protection.
7. The API makes the sole commit decision. Only afterwards may caches refresh.

A no-item operation still holds wallet/owner/hero locks; no item is invented.
Gold uses a conditional delta on the existing wallet, never a cached snapshot.
Persisted city/cost data, HERO pure plans, status/default loyalty, prompts,
capacity, friend eligibility/cooldown and template identity are retained.
Persuade final replanning reuses the preliminary plan's single captured clock;
it never changes or copies the live service mutex/RNG. Natural recruitment
remains capacity-exempt and shares only the established wallet serialization.

## Route/writer inventory

- Coming list, try/accept/reject: all replaced, with no legacy metadata fallback.
- Captive list, try/summon/release: all replaced; preview only conditionally updates
  a still-captive record, never UPSERTs an already consumed/deleted record.
- Persuade target list, persuade, lionize befriend/hire: all replaced.
- Existing hotel list/refresh/recruit and natural recruitment retain their
  reviewed coordinators. Cross-family capacity/terminal races exercise them.
- Tracked `InjectComing`/`InjectCaptive` calls remain test-only maintenance seams;
  no gateway or GM injection/capture/import route was found or added. Test seeds
  use HERO drafts plus hero/insert-only metadata in one actor/wallet/city tx.
- Upgrade/points/largess/expr begin/march claim require idle; expr completion,
  city-chief clearing and march return require their respective owned statuses.
  They cannot publish a stale excluded coming/captive status or increase owned
  count from either excluded state. Their broader concurrency is separate debt.
  `SetHeroLoyalty` has only test callers in this checkout.
- No player bootstrap, native frozen QA, foreign-domain source, or historical
  hold was edited. Any external maintenance writer needs separate inventory.

## Outcomes and evidence scope

Business errors retain existing protocol codes/messages. Ownership rejection is
unauthorized; absent/rewired coordination is unavailable. Internal and unknown
commit responses are sanitized and instruct reload without claiming rollback.
No provisional hero identity, automatic replay, compensating refund or fallback
is exposed. Confirmed commit survives cache failure, cancellation after commit
and later reload failure. Existing family routes emit no new quest event; hotel
retains its reviewed best-effort quest behavior. Durable test SQL observations
are not production recovery receipts.

Fixtures use actual ApplySpecs and production PG domain adapters. Coming/captive
rows and ready-to-hire progress are injected fixtures, not natural battle/capture
proof. The unchanged embedded CONTENT catalog does not define HERO placeholder
item 2050: default-catalog tests retain missing-item/gold errors and reject an
unregistered funded requirement atomically. Explicit test-only catalog extension
is used only to exercise planned 2050 success/debit/fault/race paths. It neither
adds production catalog data nor claims natural high-level captive availability.
Low-level/no-item, natural recruitment and lionize paths use the default catalog.

Validation includes real PG stage faults with nontransactional sequence markers
proving the fault executed, cancellation at asset/metadata/hero/commit phases,
lost acknowledgements, private pool/shard rewiring, missing schema without DDL,
connection-acquisition counts, observed owner/wallet contention across independent
API pools, no Hub-wallet cycle, and whole-state rollback/terminal stability.
Full HERO PG normal/race, focused API PG race, API PG short, all-package short,
vet, build and cleanup evidence are maintained outside the source worktree in
`api-hero-family-evidence`. Long API smoke ownership remains with the orchestrator's
other worker. Independent review and complete coordinated release remain gates.
