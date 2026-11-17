# HERO-MARCH-FORCE-TX-001

Authority: [issue #2414](https://github.com/anitaguptaoffice/sanguo-slg/issues/2414).
New implementation on main `300a64ed23ce346f09e99ffd72f709693d1c12bc` (tree `adfc317a5978810161458a1266816dae1f93bc83`), containing #2412/#2413. Four HERO files only; no Store interface, schema, API or claim edits.

## Behavior

- Production's concrete `*PGStore` exposes a private capability for both `MarchForceForHero` (normal/hotel detail) and `RestHero`. Mem/custom/Store-only wrappers retain the legacy implementation and are not proof of the PG path.
- Existing Service nil/ownership/template/read-error precedence and one clock sample remain. The capability receives actor, hero ID and that sampled time, never the stale hero snapshot.
- Force-table setup finishes before Begin. One transaction locks the exact server/player/hero, rereads level/status, then locks force. The hero lock also serializes absent-force initialization with `ClaimForMarch`.
- Rest reads force before `RestMarchForceOnce` validates the locked status. Detail retains absent-row initialization and `ApplyMarchForceRegen`. Only force/current/timestamp are written; no full hero save or pool-owned Store calls occur inside the transaction.
- Commit occurs once. Errors, including an uncertain commit, propagate unchanged without retry, compensation or fallback. Rollback uses a detached context with a five-second bound.
- Clock timing and force rules are unchanged. There is no timestamp-monotonicity promise; the existing regen helper's cap/timestamp behavior still applies.

## Required verification

Unit tests cover both dispatches, normal/hotel detail, exact context/actor/ID/time, returned latest-level cap, one clock read, nil/owner/shard/template/read precedence, error propagation without fallback writes, and Mem/custom/Store-only behavior.
Gofmt and focused HERO units ran with a temporary official Go 1.23.2 toolchain; exact test evidence accompanies source delivery. This executor has no PostgreSQL, so no local database pass is claimed. Static inspection and unit tests do not replace real PG execution. Run full ordinary/race tests and all required CI on the exact final source.

A separately registered API-HERO-FORCE-TX-PG-001 companion is required after HERO source review. It must use real NewServer/concrete PG routes and independent MaxConns=1 actor pools plus an observer. Both initial GetHero reads must finish before gates, avoiding legacy ALTER TABLE false contention. QueryTracer gates pause detail/rest after force SELECT and claim after staged force UPSERT (required when force is absent), never run SQL inside callbacks, and release/cancel/join workers before pool cleanup.
Prove detail→claim, claim→detail, rest→claim and claim→rest for existing/absent force via actual SQL, application names, PIDs and pg_blocking_pids. Bounded capability-hidden detail/rest negative controls retain concrete PG claim and demonstrate stale overwrite; they are not old-head execution. Repaired paths preserve debit, reject stale-idle rest and do not regen a marching hero over elapsed time.
Verify locked latest level/owner, missing/foreign/cross-shard/unknown-template precedence, SQL write failure, cancellation/lock cleanup, whole hero unchanged, exact timestamps and fresh-service/separate-connection reload. Controlled fixtures are not natural gameplay or restart acceptance.

## Release and limits

Publication requires baseline main/push verification. Neither HERO nor API companion merges before exact final source/composition independent review, real PG ordinary/race and all applicable CI; verify fresh main/push afterward. No deployment is authorized.
Only active PG claim/detail/rest force operations share the protocol. Other HeroDetail metadata can remain an earlier snapshot. Full-snapshot office/upgrade/expr/ReleaseFromMarch writers, direct lower-level saves, custom stores and mixed old processes are outside this guarantee. There is no force refund, uncertain-commit resolution, generation ownership, durable MIL activation, orphan/restart recovery or full playable-loop acceptance. Historical reference/art/VERIFY holds remain unchanged.
