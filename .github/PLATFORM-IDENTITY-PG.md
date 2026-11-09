# Authenticated shard identity evidence

CI-AUTH-IDENTITY-PRODUCER-001 (#2367) validates PLATFORM #2366 only after
ACCOUNT #2364 adoption. It adds no conditional legacy acceptance. The checkout is
the exact PR head (or main push SHA), not GitHub's synthetic merge commit.

Official Go 1.23.12 and PostgreSQL 17 execute the complete shard package ordinary
and race. Genuine GOROOT gofmt checks the three PLATFORM source paths. Both roots,
all five success and thirteen rejection subtests, every started test and the
terminal package result are mandatory. Any skip, missing result or failure fails
the candidate gate. Children require active parents; parents cannot finish with
active descendants. This frozen nonparallel suite rejects every pause/cont event.
Future parallel tests require a separately reviewed lifecycle-gate update.
Existing full API/ACCOUNT/world/march gates remain required.

The baseline is an explicit reconstruction: archive the exact candidate, replace
only handlers.go with frozen old producer b75cfcab, retain the adopted binding
and identical tests. Compile must succeed first. Both modes must then fail on
all five response comparisons and the zero/negative identity rejection checks.
Exactly those seven subtests and their two roots must fail; all eleven other
rejection subtests must pass. Per-case binder reset prevents cascading failures.
Race, panic and build-error markers are rejected in both candidate and baseline
JSON/stdout and stderr, even alongside otherwise complete passing results.

Fixtures use fresh databases and random owned schemas, canonical migrations,
real Login/RefreshSession, and cleanup verified by a zero remaining-schema count.
Artifacts always retain raw JSON/stderr, exits, inventory results, source tree,
hashes, tool identities and SHA256SUMS, including failure evidence. Checker
self-tests are synthetic controls, never substitutes for actual Go/PG execution.
No local compiler/tool installation, new permissions, production deployment,
concurrent-revocation guarantee, API wrapper/client correlation or V2 activation
is included. Final independent review, complete required CI and post-merge main
checks remain release gates; historical holds stay excluded.
