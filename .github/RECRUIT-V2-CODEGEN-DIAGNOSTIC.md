# Recruit V2 generated binding feasibility

Card #2342, CI-RECRUIT-CODEGEN-DIAGNOSTIC-001. Diagnostic only: NEVER MERGE.
Source contract #2340 is pinned at 90abcc2b12de455ba0b9ab8e10f5567956ca6174;
baseline cbdd409b66f48942071f8b793494d5f4af14d6a9. No generated file is committed.

The official Ubuntu compiler is 3.21.12 and the Go generator is 1.36.5, installed
from google.golang.org/protobuf with Go 1.23.12. No local Go execution is claimed.
API's historical output header is 3.13.0, platform's is 3.21.12. Baseline output
must therefore be audited first: retain the complete tracked/generated comparison,
then separately report whether compiler-header-only normalization reproduces it.
Normalization never modifies any saved output or delivery count. Any other
baseline mismatch fails the diagnostic and blocks generated adoption.

API uses the existing API mirror package and documented common-types mapping from
internal/api/MARCH-RETURNED.md. Only a temporary copy is adapted. Platform uses the
canonical command from internal/platform/gateway/README.md. Saved canonical inputs,
adapted mirror, outputs, tool identities and full diffs are hashed in the artifact.

Each domain has baseline drift, generated baseline-to-candidate, and complete
tracked-to-candidate delivery diffs/numstat. API mirror delta is additional required
card budget. Count additions AND deletions, including every descriptor change.
Do not split one generated descriptor mechanically. A downstream card needs enough
room for its complete generated output, mirror where applicable, tests and docs.
A generated delta over 400 itself blocks such a card; a smaller delta is only a
remaining-budget estimate, not approval to omit meaningful tests.

Isolated API/platform overlays each compile their domain against baseline source
and run binding package tests. Compile-only -run '^$' is not runtime acceptance;
packages without tests are not test passes. Compilation still runs after baseline
drift failure to retain diagnostic evidence; the failed gate keeps the run red. This diagnostic adds no V2 behavior
or new V2 wire assertions. A future binding card needs those tests and independent
review. Failures retain artifacts and remain failures, not compatible outputs.

Independent review is required before remote publication/run, then exact remote
composition, actual checkout, toolchain, raw outputs/counts and test results must
be audited. No production activation/deployment, main/force push or hold release.
