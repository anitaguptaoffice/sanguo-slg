# MIL-RETURN-ATOMIC-PG-001

Registered card: [#2126](https://github.com/anitaguptaoffice/sanguo-slg/issues/2126).
New tests on `c96a5e0`; production dependency is #2125, not enabled by this card.
The fixture certifies only its disposable schema, not production enrollment.

Coverage: public Complete multi-unit credit, R+P+S exactly MaxInt32, UTC microseconds,
retained heroes/troops/wounded/updated_at, unchanged queue/evidence/sequence;
public early/terminal/annihilation/Readback ignore bad current admission evidence;
due rejects tail owner/payload/FIFO/receipt/manifest and both capacity overflows.
Trace asserts one post-lock clock for due, zero for terminal, and no allocation.
Distinct backend PIDs and pg_blocking_pids witness duplicate Complete and Readback
waiting for commit/rollback. Atomic trace observation orders caller Access replacement.
Fixtures hold only MIL pins/rows; this wait is at the MIL marker, not ACCOUNT,
wallet or WORLD caller locks. Cross-domain city barriers/Recruit compatibility are unproved.
Independent pool snapshots witness provisional invisibility and final persisted rows.
Public Complete followed by actual outer rollback or SQL division error rolls back.
The private-helper stale snapshot case reaches a real fourth UPDATE affecting zero;
it is helper-only and explicitly rolls back, not a reachable public fault callback.
Nil/wrong/ended/copied Access, cancellation, source drift/shared retirement reject.

Not yet executed: local `go` is not the Go toolchain and `gofmt` is unavailable.
Missing-API compile failure is not behavioral red. Official Go 1.23.12 / PG17 full
MARCH ordinary and race, zero skips/fails, exact-head review and required CI remain.
Separate evidence must cover public read-only invalid-stock/lifecycle combinations
and deferred commit failure on an isolated auxiliary relation. Lost acknowledgement,
process death, APP unknown cleanup, production composition and activation remain out.
Applied is provisional until outer commit; no cache, HERO or production claim.
