# Actual ACCOUNT identity bindings acceptance

CI card [#2363](https://github.com/anitaguptaoffice/sanguo-slg/issues/2363)
accepts independently reviewed source card
[#2360](https://github.com/anitaguptaoffice/sanguo-slg/issues/2360).
Pre-SPEC baseline: `722d56bf10a5edc555873c0e4dac7a9545c9c60b`.
SPEC: #2356 / #2358. Diagnostic #2362 is NEVER MERGE and is not this gate.

Every push to main and pull request executes the actual binding package with
Go 1.23.12, GOTOOLCHAIN=local, ordinary and race. Six identity roots and eleven
named subcases must run and pass; every additional started test must also pass.
Empty, malformed, wrong-package, duplicate, incomplete, skipped or failed
Go JSON is rejected, including evidence after terminal package PASS. Mutations
of each genuine passing log exercise missing roots/subcases, skip, fail,
malformed, duplicate and truncated evidence; all mutated logs are retained.
These negative controls test the checker, not business behavior.

Official protoc 3.21.12 and protoc-gen-go 1.36.5 regenerate complete canonical
baseline and candidate files in separate archived trees. Both account bindings
must match tracked files byte-for-byte, without header normalization. Common
bindings match tracked bytes and each other across snapshots. Full canonical
inputs, generated/tracked artifacts, raw diffs, hashes, source/head/tree, tool
provenance, official formatting, compilation and test logs are uploaded even
on failure. The checkout is never modified by generation.

Copying the same final tests onto the untouched baseline must fail to compile
with the absent AccountId/GetAccountId API. This is tests-first compile evidence,
not behavioral regression. Runtime backward compatibility is checked by the
actual source tests, frozen descriptor hash and fixed wire bytes.

The existing ACCOUNT root-only PostgreSQL workflow remains unchanged, including
32 roots / 98 outcomes. Full ACCOUNT real-PG ordinary/race and API gates remain
separate mandatory checks. This new package does not require a legacy-state
migration or duplicate the full expensive suites. No skipped legacy acceptance
path exists. Source must be independently reviewed before stacked publication;
retarget CI normally after source adoption and renew exact-head combined review.

Local Go/protoc are unavailable; local Python/shell checks are not runtime PASS.
All required exact-final-head CI, independent source/CI/combination review and
raw-artifact audit precede authorized merge; main push checks follow merge.
Representation does not activate authenticated identity emission, prove positive
business identity, authorize deployment, or release any historical hold.
