# Actual Recruit V2 API bindings acceptance

CI-first migration [#2353](https://github.com/anitaguptaoffice/sanguo-slg/issues/2353)
validates source [#2348](https://github.com/anitaguptaoffice/sanguo-slg/issues/2348).
Initial source: `7000acdac03007d4575bd38c331a15d2729b674c`, tree
`91f1ffe7997c8ece7e15afed1358911b84df8551`; frozen old API baseline:
`34bfa7c6a56ed4c0c44598ffe98c871bf15da85c`.

The workflow records actual checkout/tree and source hashes, official Go 1.23.12
with GOTOOLCHAIN=local, protoc 3.21.12 and protoc-gen-go 1.36.5 provenance.
It validates canonical-to-API package adaptation and the existing common import
mapping, regenerates complete artifacts, checks whole candidate byte equality,
and permits only the exact historical protoc header change in baseline output.
Artifacts retain both full generated/tracked files, raw diffs, inputs and hashes.
No generated code is hand-edited or split. Official formatting and actual package
compile plus all package tests in ordinary/race modes are mandatory.

Four expected test roots and three descriptor subcases must run and pass in genuine Go JSON, every started
subtest must pass, and the package must end in PASS. Any skip/fail, missing root,
malformed JSON or compile failure fails the gate. The gate's negative fixtures
are synthetic parser checks, never runtime acceptance evidence. The frozen old
API lacks V2 types: copying new tests there demonstrates tests-first compile
failure, explicitly NOT a behavioral regression. Runtime compatibility evidence
comes from the source tests, legacy descriptor hash and fixed legacy wire bytes.

Full API PostgreSQL now requires the existing 252 scenarios plus four military
roots and three descriptor subcases (259 total); preflight stays at 27. Only
military leaves the no-test package set. Full commands, ordinary/race, zero
skip/fail and terminal checks are unchanged; all other required checks remain
separate mandatory gates. This job does not replace them or activate V2.
Local Go/protoc are absent; Python/shell static checks are not runtime PASS.
Exact component/composition/source-to-remote review, real artifact review and
all required exact-head checks precede coordinator-controlled serialized merge.
Changed source/base requires renewed affected review and tests. No main push,
force push, production deployment, security changes or historical hold release.

## CI-first migration

Supersedes closed NEVER-MERGE #2351, preserving its accepted artifact13626458615.
Legacy state requires both exact frozen old source hashes, no tracked/worktree test
file, and unshallow successful HEAD --full-history proof that it never existed.
Partial adoption, modified legacy source or adoption-then-deletion fails closed.
Both workflows use the same state guard. Only validated legacy omits V2 steps;
that is NOT V2 acceptance and full API ordinary/race still requires original252.
After adoption all259 and every V2 regeneration/test gate are mandatory. No
source files belong to this CI-first card. Merge accepted CI to main first, then
normally merge main into the separate API card and require fresh259 acceptance.
