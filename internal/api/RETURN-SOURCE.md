# API-RETURN-SOURCE-001

Task [#2135](https://github.com/anitaguptaoffice/sanguo-slg/issues/2135).
Private, dormant source assembly. `newReturnGeneration` performs no SQL and
captures Binding and catalog wrappers plus a defensive exact 43-object profile.
The catalog's public API is immutable; MIL deep-copies its retained manifests.
Concurrent mutation during capture and external pool closure are not protected.

Copies share one owner, admission, initialization attempt and irreversible close.
`initialize` consumes its attempt before context validation. One leased bounded
transaction constructs ACCOUNT, DOM, WORLD RecruitCityLocker and MIL, then pins
in that order. It performs no business row locks, writes or sequence allocation.
Only confirmed Rollback allows the complete bundle to be attached. Errors close
and discard everything; cleanup has an independent five-second context. Invoked
Begin failure, failed rollback and cleanup panic retain unknown pending work.
Original panics propagate after cleanup and retained phase/cause diagnostics.

Tests first: immutable captures, exact projections, invalid input and shared
one-shot closure. Local `go` is not Go; no runtime pass or behavioral red claimed.
Required official ordinary/race and separate real PG17 composition evidence
remain merge gates. No enrollment, Complete/Commit, recovery, runtime wiring,
publication or deployment is supplied. Matching metadata is not source approval.
