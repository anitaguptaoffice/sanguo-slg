# Durable arrival PostgreSQL acceptance

Card #1981 / MIL-ARRIVAL-RESOLVER-PG-001, stacked on #1980 at
`d4beda0ce87881bc1c26ae8a4929e1c4a2f678e3`. New tests, not prior PASS evidence.

`TestPGDurableResolverHubRestore` requires an owned disposable PostgreSQL 17
DATABASE_URL. It creates and cleans its own schema, applying the reviewed
004_military, m4_009_march_identity and 005_hero SQL bodies. No production
schema, runtime route, persistent credit writer, dependency or CI is changed.
The fixture profile is test-only and is not production source approval.

Coverage: real Resolver -> MarchTransition -> outer transaction -> Hub;
battle and no-battle surviving returns; annihilation; report insertion failure;
deferred constraint trigger failure at the outer COMMIT; row rollback observed
from an independent connection; unchanged Hub troops/defenders and quarantine;
restore/activation with frozen return ETA; no repeated combat or report;
unchanged persistent city_troop, including after the in-memory return event.
Report/army/order rows are checked with xmin/ctid; sequence gaps after rollback
are allowed by PostgreSQL and are not mistaken for partial row commits.

Run from the repository root with Go >=1.23 and the owned PG17 URL exported:

```sh
go test -count=1 -v ./internal/military/combat -run '^TestPGDurableResolver(HubRestore|ProcessRestart)$'
go test -race -count=1 -v ./internal/military/combat -run '^TestPGDurableResolver(HubRestore|ProcessRestart)$'
go test -count=1 ./internal/military/combat ./internal/military/march ./internal/military/report
go test -race -count=1 ./internal/military/combat ./internal/military/march ./internal/military/report
```

Record exact commit, server version, commands, test/subtest counts, no skips,
results and cleanup. Missing DATABASE_URL skips the PG test and is **not** a
pass. A non-PG17 server fails. The wider march suite also needs psql.

## HOLD

At authoring time, no usable Go compiler/gofmt/PostgreSQL toolchain is available.
Compilation, formatting, ordinary/race execution and PG17 acceptance remain
unverified. Keep this PR and #1980 Draft/HOLD until exact-head independent review,
applicable ordinary/race tests and required CI pass with real PG17 evidence.
The commit failpoint proves a definite server-side rollback, not an uncertain
network outcome; uncertain commits still require persisted-state reconciliation.
No activation/deployment or durable return-credit acceptance is claimed.

## Independent process acceptance

`TestPGDurableResolverProcessRestart` uses two separate copies of the test binary.
The first resolves a real battle and exits abruptly with code 17 after confirmed
commit, bypassing deferred connection cleanup. The second process restores the
frozen return and must not call the arrival resolver. An independent parent
connection checks row identity/content and unchanged city stock across both.
Run it normally and with `-race`; children inherit the instrumented test binary.
Child GORACE halts on a race with exit 66 (never accepted as deliberate exit 17);
the parent also rejects race diagnostics instead of discarding them.
This is not physical PostgreSQL restart or uncertain-network COMMIT evidence.
Existing held branches stay unchanged until final validation and review complete.
