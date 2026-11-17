# API-RETURN-ATTEMPT-SERIALIZATION-PG-001

Task [#2154](https://github.com/anitaguptaoffice/sanguo-slg/issues/2154).
Base `53848e0897f61edb69e20f292b8010716dfab804`, tree
`8d3e7c86dc1939ac0dda1163b9090f05bb75aba7`: actual private APP source
[#2145](https://github.com/anitaguptaoffice/sanguo-slg/issues/2145) and flow fixture
[#2146](https://github.com/anitaguptaoffice/sanguo-slg/issues/2146).
Tests-first checkpoint `074005833b1aaefa653d164e56d5ed57e1fb1179` is source only,
not a compiled or behavioral-red result. Exactly two new API files; no shared edits.

## Observable matrix

`TestPGReturnAttemptDuplicateWalletWorldSerialization` exercises due, early,
credited-terminal and annihilated-terminal branches through real `complete` calls.
Every branch uses three actual concurrent commands and independent connections:
1. Lock the first actor's wallet. Observe its actual backend SQL, lock wait and
   exact `pg_blocking_pids` before acquiring the WORLD row with NOWAIT. Success
   proves the wallet waiter has not already taken that WORLD lock.
2. Release wallet; observe the same backend now waiting on the WORLD blocker.
   Start its duplicate and observe it waiting on the first command's wallet.
   Assert both remain admitted and the full committed snapshot is unchanged.
3. Complete a different actor/wallet/city while both commands remain blocked.
   Require a distinct third PID, applied outcome and its committed rows. Reobserve
   both blockers and the unchanged first city's counts/status/position.
4. Release WORLD and require both real successful outcomes. Due returns applied
   then credited-terminal with one addition, not two; other branches retain their
   exact read-only dispositions. Every attempt has one BEGIN/COMMIT, no ROLLBACK,
   no ID allocation, and the expected PG clock count. No failed/unknown outcome
   is substituted for successful serialization or treated as a retry invitation.

Independent snapshots include all tables and sequence state, retained identity,
deadline, survivors, wounded, wallet, HERO and pending rows. Only allowed credit,
status and position fields are masked in the stable comparison; exact committed
values are checked for both cities. Read-only branches additionally compare full
physical tuple snapshots after the independent city finishes. Pending Recruit
rows are synthetic accepted evidence, not a Recruit command or enrollment proof.

## Boundaries and remaining gates

Every caller, lock acquisition and witness has a deadline. Cleanup cancels all
callers, closes blockers, joins goroutines, and checks server transactions/locks
and acquired pool connections before inherited pool teardown. A failed join uses
an independent bounded connection to terminate only observed unfinished fixture
backends, then joins again. Cleanup failure fails the test; it cannot resolve an
APP unknown record or reopen admission. No sleeps are used as blocking evidence.

This is wallet-to-WORLD and duplicate evidence, not the full ordered-lock audit.
ACCOUNT account/player ordering, every relation-pin prefix, WORLD-to-marker/stock/
queue/march/army/troop order, error/readback branches and actual Recruit admission/
completion interoperability remain separate acceptance gates. There is no durable
Recruit APP coordinator to call: [#1950](https://github.com/anitaguptaoffice/sanguo-slg/issues/1950)
retains the missing V2 command-identity transport gate; current handler/Hub paths
are in memory. No test-only replacement coordinator is introduced.

The source/fixture dependencies remain subject to final combined review and runtime
validation, including PLATFORM [#2147](https://github.com/anitaguptaoffice/sanguo-slg/issues/2147)
/ [#2150](https://github.com/anitaguptaoffice/sanguo-slg/pull/2150) and initialization
[#2142](https://github.com/anitaguptaoffice/sanguo-slg/issues/2142). Network #2148,
failure #2152 and lifetime #2153 cards own other files and uncertainty coverage.
Local Go is unavailable: no compile, gofmt, PostgreSQL or race PASS is claimed.
Official Go1.23.12/PG17.11 ordinary and race execution must pass all four named
subtests with zero unexpected skips, plus the full applicable suites, independent
exact-head/composed review and required CI. Source stays default off. No publishing,
merge, production wiring/deployment, recovery, unknown clearing or hold release.
