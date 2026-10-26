# HERO family transaction prerequisites

These are inactive building blocks, not an atomicity claim for existing routes.
API must replace coming/captive/lionize and hotel writers together, preserving
legacy gameplay until that coordinated activation. API owns actor/wallet/owner
locks, building reads, assets, cancellation, and the single commit.

`PlanComingAccept/Reject` and `PlanCaptivePreview/Summon/Release` only inspect and
copy caller-supplied authoritative snapshots. Coming/captive city 0 retains the
legacy omitted-city behavior; API must resolve and authorize metadata's city.
Cross-city owned count still excludes coming/captive. Preview infers requirements
only when both stored fields are zero; partially populated values are preserved.
No new summon probabilities, salary, items, capacity rules or hero identity.

Plans are not reservations: re-read/replan under the shared wallet lock and
final ordered hero/metadata locks after all item locks. Discard after rollback or
unknown commit. A failed write requires the caller to roll back all participants.
No legacy method is safe to call inside the coordinator merely because a plan
exists; those methods still own pool work and lazy DDL.

`Service.PlanLionize` returns befriending gold or a zero-ID hire draft plus the
new progress record. `Service.PlanPersuade` returns the existing item debit and
progress/cooldown. Both preserve the four-target roster and current eligibility,
including coming counting as an already-owned template but captive not counting.
Persuade/hire capture the server clock once and never use RNG; befriending does
not need a clock. No wallet/item balance is authoritative in a plan: API must
conditionally debit the exact returned costs in the same transaction.

`PGStore.LockPlayerHeroesInTx` takes ascending hero row locks; use the existing
unlocked `ListPlayerHeroesInTx` only for wallet-protected preliminary item plans.
`SetFamilyHeroIdleInTx` changes only status/loyalty, conditioned on shard, owner,
identity and original coming/captive status. `DeleteFamilyHeroInTx` rechecks and
locks that same condition before deleting the legacy assignment and hero.
Neither touches auxiliary metadata implicitly. Optional added-point columns are
read without DDL and never rewritten; their formal migration remains separate debt.

## Source-based activation inventory (base `3cc50a6`)

- `internal/api/hero_wire.go` wires all three real PG metadata stores with the
  HERO store. `hero_gateway.go` dispatches coming list/try/accept/reject, captive
  list/try/summon/release, and persuade list/persuade/lionize to the three handler
  files. These legacy methods remain live and unchanged by these prerequisites.
- `coming.go`: acceptance status+metadata delete and reject metadata+hero delete
  conflict on the same offer. `captive.go`: TrySummon itself writes inferred
  requirements; summon also invokes it, then changes status/deletes metadata;
  release deletes both. Every one needs the shared wallet/hero/metadata protocol.
- `persuade.go`: initial befriend, persuade progress/cooldown and hire all call
  the same progress store. Missing progress is serialized by wallet, not a
  nonexistent metadata row lock; stale befriend/persuade may not replace state 2.
- `InjectComing`/`InjectCaptive` are exported GM/test seams; tracked callsites
  outside their definitions are tests. `cmd/gm` exposes lookup/grant/kick/mute/mail,
  not these injection methods. No online capture/import/owner-transfer route was
  found in this checkout; this is not proof about external maintenance jobs.
  Any authorized injection must compose new hero and insert-only metadata in the
  same tx; do not use insert as repair for missing/orphan metadata. Imports and
  owner transfer require separate inventory, identity highwater and wallet rules.
- `PGStore.SaveHero` is update-only, but rewrites a full snapshot. Existing
  upgrade/points/largess/office/expr/march paths have their own status eligibility;
  this work does not declare their broader concurrency safe. `SetHeroLoyalty`
  has only test callers here. No unrelated method is switched or disabled.
- Natural `RecruitPlayer`/`RecruitAndPersist` PG closure is retained. Production
  natural API coordination already owns wallet through insertion, without office
  capacity gating. Hotel and family acceptance must not invent that gate for it.

Before release, the API owner must inventory actual wiring and maintenance
writers again, validate same-pool/schema provenance and reviewed schema readiness,
then activate all compatible routes together. Domain tx methods do not prove
which pool/schema supplied an arbitrary `pgx.Tx`, nor acquire API wallet locks.

`PlanComingInjection`/`PlanCaptiveInjection` preserve existing seed defaults and
capture time once, without RNG or storage. They produce zero-ID drafts only;
no runtime route or import mechanism is introduced by these helpers.

## Metadata participants (requires the full reviewed metadata schema stack)

**Order: consume metadata first, then conditional hero status/loyalty or delete,
then commit once. Roll back if either write fails.** Reversed order deliberately
fails the metadata writer's still-coming/captive owner+status precondition.
`GetComingInTx`/`GetCaptiveInTx` use `lock=false` ONLY after actor+wallet locking
for item planning. Final execution must re-read with `lock=true` after item and
ordered hero locks, replan and compare the current record. No caller snapshot is
trusted without those locks. Preview uses conditional `UpdateCaptiveInTx`;
accept/summon/reject/release use exact `ConsumeComing/CaptiveInTx`.
`InsertComing/CaptiveInTx` are separate insert-only injection prerequisites and
must accompany `CreateHeroInTx` in the same caller-owned transaction. Metadata
updates/deletes never create rows, and terminal status prevents stale mutations.

Lionize uses `GetLionizeInTx` followed by `CompareAndSwapLionizeInTx`; absent
progress is an insert-only befriend, existing progress compares friend/state/
nullable timestamp, and state 2 cannot be overwritten. A failed low-level CAS
returns `ErrInvalidFamilyState`; normal business errors come from replanning the
locked current row. Do not retry stale plans. `ListLionizeInTx` preserves all
stored NPC rows; `PlanPersuadeTargets` applies the unchanged four-target display.
`PlanComingPreview` preserves the existing accept prompt. Coming/captive list,
coming try, captive try, persuade list and every mutating sibling route all need
coordinated replacement so no lazy-store read/preview fallback survives.

Validation uses actual ApplySpecs and real PG metadata stores (nil adapter pools),
not memory metadata attached to PG hero storage. Tests cover missing/malformed
schema errors, exact nullable progress, injection/transition/hire rollback,
conditional stale rejection, metadata locks, observed concurrent stale CAS after
hire, untouched hero columns and no resurrection. These are domain-participant
checks, not production API wallet/item/owner-lock or deployment acceptance.
