# Real PostgreSQL hero march claims

API-HERO-MARCH-CLAIM-PG-001 (#2411) is the mandatory integration companion to
HERO-MARCH-CLAIM-TX-001 (#2410), Draft PR #2412. Assigned source:
`daf71c5a47c4b2fcde9bba923683aef88b12bcfa`, tree
`1076da8fe2c80b83c511249396666cf34b9939e6`, on main
`dfb4e8748afbe260f7449ba69a11c6292a50ffe0`. No HERO source is changed here.

- Gateway: stock registrationServer/NewServer/wireM3, unwrapped PGStore, actual
  city and military registration. For present and absent force, a schema-local
  status trigger verifies the staged force/time before raising P0001 with named
  constraint claim_status_probe. The gateway's exact error and a separate explicit
  service call's PgError metadata prove the injection fired. Peer SQL checks the
  full hero row, force/time and absence of armies. Existing-force time is older
  than the staged time. Drop injection, explicitly claim, run real arrival release,
  then explicitly claim again: two costs total, no automatic retry or refund.
  A fresh service reloads all HERO fields and force from a separate pool.
- Eligibility: missing, foreign, cross-shard, chief, every other nonidle status,
  canceled context, successful regeneration, and partial regeneration still below
  cost. The latter retains both stored force and timestamp unchanged.
- Contention: independent pools/services, each MaxConns=1. Concrete PGStore
  embedding pauses both completed idle preflight reads. Only then acquire the
  hero-row barrier, resume and observe both exact atomic SELECT FOR UPDATE queries
  waiting, scoped by application name and PID. pg_blocking_pids must remain within
  the two claimants/barrier, with a direct barrier edge (the other claimant can
  wait behind its peer's tuple lock). Unlock: exactly one success, one not-idle,
  one debit/status transition. Repeat for present/absent force. Contexts bound new
  operations; cancellation, unpause, rollback and worker joins precede pool/schema
  teardown even on fatal assertions. Single-connection claimants expose accidental
  pool access while a transaction is held.

Run with a real DATABASE_URL: `go test ./internal/api -run '^TestHeroMarchClaimPG' -count=1 -v`,
then the same with `-race`. Existing full API ordinary/race CI discovers these roots
and rejects skips. This checkout has no Go toolchain/PostgreSQL: no local execution
is claimed. Independent component/combined review, exact-head full CI and verified
main composition remain mandatory before merge; publication maps commits in the PR.

Controlled clocks, seeded hero/stock and manual scheduler polling are fixtures,
not natural gameplay or restart acceptance. MIL remains nondurable. Other HERO
writers/release, durable create/arrival/return, unknown commits and deployment are
outside scope. Existing Store-only fault wrappers still exercise legacy fallback;
their guarded results are unchanged and are not evidence for this PG capability.
Pre-fix code retains force after the injected status failure and cannot expose the
required atomic claim waiters. Historical art/reference/VERIFY holds remain intact.
