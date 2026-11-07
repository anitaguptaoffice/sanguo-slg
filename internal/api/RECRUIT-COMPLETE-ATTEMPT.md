# Dormant single-candidate Recruit completion

API-RECRUIT-COMPLETE-001 / #2221. New APP implementation on immutable cleanup
#2219 head `848f1f403b4a40a589e1e2a869383a515dd976a3`, itself on actual source
#2209 `89459bd7e8d1da6efa04399fcf6ca42492e7d9ae`. Adopted Recruit ports #1902,
readiness #1940 and [#1950 correction](https://github.com/anitaguptaoffice/sanguo-slg/issues/1950#issuecomment-6693764994)
govern this method. Source review is not runtime or activation acceptance.

`recruitGeneration.complete` accepts a copied trusted service candidate, not a
player request. Deadline/live context, positive captured shard/player/city and
queue 1..9007199254740991 are local requirements. Account/player/city retain the
positive int64 port contract; this private operation invents no public numeric ABI.
Bad input or unavailable generation returns not-started without lease or Begin.

The same generation mutex, 34-object source, Binding, admission and attempt map
are used. Registration retains candidate, queue and explicit completion kind
before Begin; resolved account is retained before its mandatory locked recheck.
Order: ACCOUNT/DOM/WORLD/MIL pins, AccountHint, account/player Lock, existing
wallet Lock, CompletionHint. Hint 2 takes DoneHistory only; 0/1 takes WORLD Lock
then Complete. Invalid hints/dispositions fail. There is no route fallback.
The sole Commit follows full validation; nil Commit sets confirmed completion
before cleanup/bookkeeping. The admission acceptance field remains zero.

| Branch | Result after confirmed end | Lifetime |
| --- | --- | --- |
| Valid done history | AlreadyDone, no current city/readiness path | Open |
| Valid active early / waiter | Early / Waiting, no writes | Open |
| Valid due active | Completed, atomic credit/done/oldest promotion | Open |
| Foreign/missing/canceled/corrupt candidate or participant error | Rollback, known-ended only on confirmed end | Conservative retirement |
| Invoked Commit failure/panic or uncertain cleanup | Unknown, no confirmed disposition | Retain exact attempt/candidate; no drain/retry |
| Nil Commit then bookkeeping loss | Confirmed disposition survives; separate diagnostic | Close; retain record |

The actual deferred function recovers and passes its panic to the existing end
helper. Five-second independent rollback and original/cleanup panic priority are
unchanged. MIL still owns authoritative post-lock PG time, inclusive due equality,
clock reversal, retained rule evidence, capacity R+P conservation and promotion.
APP adds no SQL, clock, debit, ID allocation, callback runner or result mutation.

Unit inventory: TestRecruitCompletionPreflight, TestRecruitCompletionDisposition,
TestRecruitCompletionBookkeeping (six outcomes x three bookkeeping cases).
Bookkeeping tests are not transaction simulations or DB evidence. Existing
admission/source/cleanup tests remain required. Local Go, gofmt, PG and race were
not run; official exact-head compilation/formatting/tests/CI remain mandatory.
Separate real PG cards must cover actual completion branches, SQL/commit faults,
lock/serialization, ownership/source changes, panic/close/network/process lifetime
and actual completion-versus-Return ledgers. No old admission-only interop pass
closes those gates. No live caller, scanner, shared controller, recovery, public
V2, Hub/quest publication, production enrollment/deployment or hold release exists.
