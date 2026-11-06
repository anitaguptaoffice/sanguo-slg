# API-RETURN-ATTEMPT-001

Task [#2145](https://github.com/anitaguptaoffice/sanguo-slg/issues/2145).
Private dormant `complete` composes the adopted return ports, never a live caller.
Preflight precedes SQL. Admission and bundle capture use state → admission lock
order. Unique pointer identities retain candidate/generation before the sole Begin.
Active records say `admitted`; final phase/result/panics are published under state
lock. All relation pins precede ACCOUNT hint/actor, wallet, WORLD and MIL locks.
Wallet is never debited. Only structural observation checks occur in APP.

The result separates confirmed observation from cause, cleanup and diagnostics.
Only nil Commit confirms; no rollback follows it. ErrOutcomeUnknown and commit
panic remain unknown despite later ErrInactive. Other commit errors require nil
independent five-second rollback for known-ended. Invoked Begin without Owner is
unknown. Original panic wins over cleanup panic, after recording. Unknown records
and leases persist permanently; no recovery/replay/clear API exists. Clean resolved
records are removed. Bookkeeping faults close admission without changing outcome.
Close never cancels admitted copies or waits for drain under locks.

Every MIL Complete error includes Unavailable, so Source is checked first; other
MIL failures with known rollback need not retire admission or imply capacity loss.
DOM distinguishes Source/Unavailable. Ambiguous ACCOUNT/WORLD and other upstream
errors conservatively close generation, sacrificing availability without asserting
metadata drift. No error string guessing or new public error is introduced.

Pure tests cover input, observations and bookkeeping, not database execution.
Local Go is unavailable; compilation/runtime and real PG17 ordinary/race companion
evidence remain required before merge, along with independent review and all CI.
No production wiring, cache/hero publication, enrollment, SQL or migration is added.
