# Arrival deadline and restart compatibility

MIL-ARRIVAL-DEADLINE-001 (#2468) fixes the already-adopted arrival writer,
not the held resolver or startup wiring. A returning march must persist a
return deadline strictly after its locked order's arrival timestamp, matching
MarchRestore's existing whole-snapshot validation.

The writer locks and reads status and arrival together. After preserving the
missing/replayed status outcomes (including infinite stored timestamps), it
requires a finite arrival and canonicalizes a surviving army's deadline
to UTC microseconds, checks the supported year range and strict ordering, and
uses that exact value for the write. A nanosecond-only difference cannot become
an equal PostgreSQL timestamp. Invalid deadlines fail before any savepoint,
report allocation, or row write. An all-dead battle remains terminal with NULL
return deadline; it does not acquire a returning event.

The real PostgreSQL suite covers battle and no-battle paths, before/equal and
sub-microsecond rejection, valid microsecond/fractional/zoned values, UTC year
boundaries, caller commit after refusal, independent pre-commit visibility,
locked-row refresh after a competing update, status precedence, and terminal
hero release. Rejection checks include row contents, xmin/ctid, and all three
identity allocators. Fresh restore objects must accept committed valid results,
stage the exact return event, and leave source rows and allocators unchanged.
The shared arrival fixture uses fixed valid depart/arrival/return timestamps.

Acceptance requires the official full March PostgreSQL ordinary/race runs,
independent source/composition and raw-evidence review, and all applicable CI.
Local database skips are not acceptance. This does not activate persistent
runtime routes, migrate old invalid rows, deploy, or prove a server-process
restart. The existing whole-snapshot rejection and historical holds remain.
