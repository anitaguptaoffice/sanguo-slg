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
go test -count=1 -v ./internal/military/combat -run '^TestPGDurableResolverHubRestore$'
go test -race -count=1 -v ./internal/military/combat -run '^TestPGDurableResolverHubRestore$'
go test -count=1 ./internal/military/combat ./internal/military/march ./internal/military/report
go test -race -count=1 ./internal/military/combat ./internal/military/march ./internal/military/report
```

Record exact commit, server version, commands, test/subtest counts, no skips,
results and cleanup. Missing DATABASE_URL skips the PG test and is **not** a
pass. A non-PG17 server fails. The wider march suite also needs psql.

## Local acceptance (2026-11-17)

The original authoring toolchain limitation is resolved. The normal composition
of original #1980/#1983 with main was independently reviewed at source commit
3768283694e26857be6442f01cdf5de86cdfb8d2 (tree
6cba75917dc8d6ef26cd692ea06c3da79386b40c). Owned PostgreSQL 17 ordinary and race
runs of `./internal/military/...` each passed 217 root tests with no skipped test
cases, including all five real Resolver/Hub/Restore scenarios above. The parent
package has no test files; its package-level skip is not a skipped test case.
The later merge of main cf140156 changes only API files; military source blobs
remain identical. Formatting is checked separately on the changed Go paths.
User-authorized local acceptance replaces waiting for online CI; this record
supersedes the historical toolchain/merge hold, not the runtime limitations.

## Runtime limitations
The commit failpoint proves a definite server-side rollback, not an uncertain
network outcome; uncertain commits still require persisted-state reconciliation.
No activation/deployment or durable return-credit acceptance is claimed.
