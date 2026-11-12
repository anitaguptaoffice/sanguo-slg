# ACCOUNT identity generator diagnostic (NEVER MERGE)

Task #2361 supports source #2360 without changing or replacing its scope.
This Draft-only workflow runs on its named non-main pull-request branch.
No source file, schema, package mapping or generated binding is committed here.

Frozen baseline: 722d56bf10a5edc555873c0e4dac7a9545c9c60b.
Frozen adopted SPEC: 33575215f9f66e9d535db40840e918afe5a2bcba.
Tools: Go 1.23.12 / GOTOOLCHAIN=local; official Ubuntu 24.04
protobuf-compiler 3.21.12-8.2ubuntu0.4; official protoc-gen-go v1.36.5.
The canonical README command runs unmodified on independent archived snapshots;
no private proto mirror or go_package rewrite is permitted.

The artifact contains complete generated account/common outputs, tracked bytes,
canonical inputs, tool/binary hashes, versions, executed command, source commit
and tree provenance, complete diffs and numstat, and whole-file equality results.
Any baseline byte drift is a failure, without header normalization. Common must
remain unchanged both against tracked bytes and across frozen snapshots.
SHA256SUMS covers all files, including evidence from a failed generation.

Candidate compile overlays the real generated output on the adopted snapshot
and compiles ACCOUNT plus PLATFORM/API importers. It does not execute new
identity tests, replace full ordinary/race PostgreSQL gates, activate account
identity emission, or prove the eventual source PR. Exact workflow/mapping must
receive independent review before publication/run; raw downloaded artifacts
must receive independent hash, baseline, scope and provenance audit before use.
Source #2360 must include the complete generated diff within its own 400-line
budget and verify its final source/tests independently. Main CI #2359 remains
separate. Keep this diagnostic PR Draft and never merge it.
