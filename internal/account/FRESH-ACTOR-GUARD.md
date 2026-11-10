# Dormant fresh-city ACCOUNT guard

Task [#2421](https://github.com/anitaguptaoffice/sanguo-slg/issues/2421).
Contract: `spec/rules/FRESH_CITY_PARTICIPANTS.md` sections 4–5.

`NewActorGuard` constructs its own private concrete `RecruitActorGuard`, reusing
the complete reviewed ACCOUNT catalog, profile-copy and transaction-lock checks.
`Pin` acquires account then player ROW SHARE. `LockActor` requires those pins,
checks the active account, then exact shard/player/account ownership FOR SHARE.
Both row locks remain until the caller's transaction ends. Zero handles fail;
copies share retirement. Errors retain the existing ACCOUNT guard classifications.
Each method snapshots Access privately while retaining its exact transaction state.
No caller can inject an implementation, raw transaction, pool or success callback.

APP still owns trusted authentication, source enrollment/provenance, lease, global
pin/row order and transaction lifetime. This guard creates no rows, allocates no
identity, changes no settings and publishes no state. It has no production caller.
It does not establish first-city eligibility, a receipt or safe retry. #2378's
command-recovery boundary, DOM staging and full APP composition remain open.

The existing `Account return PostgreSQL` workflow runs the full ACCOUNT package
on isolated PostgreSQL 17 databases in ordinary and race modes, rejecting skips.
Inspect the `TestFreshActorGuard*` / `TestPGFreshActorGuard*` events as well as the
reused Recruit and catalog regressions. New tests exercise the actual public
fresh guard, copied profile, source drift, authority, pin order, lifetime,
read-only behavior and writer blocking through both transaction outcomes.
Fixture-observed identities are only test inputs, never deployment approval.
No production enrollment, onboarding, deployment or historical hold is enabled.
