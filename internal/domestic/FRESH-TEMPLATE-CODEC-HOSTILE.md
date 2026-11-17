# FCT1 hostile-input and differential-fuzz audit

This companion owns rejection completeness and parser safety. It depends on the
complete pure codec and canonical audit's fixture reader/independent parser.
Every truncated byte prefix of all four literal vectors and one appended zero
byte per vector must fail after recomputing SHA-256, so digest mismatch cannot hide framing
bugs. Mutations cover all numeric families, counts, overflow, invalid UTF-8,
forbidden slot/label values, unsorted/duplicate records, missing references,
unused catalog values, metadata changes and the outer byte-length cap.

Input snapshot tests cover fixed fresh-state invariants and reject without
mutating inputs or returning partial data. Overlength validation is checked to
allocate nothing. Maximum count/size positives belong to the canonical companion.
The fuzz target derives candidate metadata independently and recomputes digest;
production and independent parsing must agree, return no partial failure values
and reproduce successful bytes exactly. Fuzz seeds are all four positive shapes.

Run focused ordinary/race tests and differential fuzzing against the complete
final set. Retain failing attempts and exact final toolchain/evidence separately.
All three components require combined independent review and required CI before
any merge. These pure tests use no SQL and establish no PG/process acceptance.
