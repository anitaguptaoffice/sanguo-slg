# Rejected march claim cleanup

After an acknowledged successful HERO claim, every current legacy MIL
CreateMarch error is a definite rejection before troop deduction, publication
or scheduling. The existing single HERO release now uses a fresh five-second
context that retains request values but not request cancellation or deadline.
Its timer is canceled on handler return. The original MIL response is preserved.

This prevents a disconnected request from itself blocking compensation. Tests
cover the actual gateway, successful/failed cleanup, uncanceled rejection,
failed and ambiguously acknowledged claims, and canceled successful creation.
The PostgreSQL regression cancels only after the real claim save returned and
uses a separate pool to verify committed idle status and unchanged march tables.

This is best-effort compensation, not a transaction or retry mechanism. Existing
force deduction and domestic settlement are unchanged. Failed/timed-out cleanup,
unknown claim saves, concurrent non-atomic HERO writers, crashes and restarts
remain outside this repair. The deadline bounds cooperative context-aware stores.
Durable orphan scanning and creation cutover remain separate tasks; no historical
hold or complete playable-loop acceptance is released by this fix.

Required validation: both new TestMarchRejectedClaimCleanup roots, all seven
unit subcases, full API ordinary/race including the real PG test without skips,
existing build/lint/CI and independent final source/evidence review. Local Go
execution is unavailable in the authoring environment; official execution must
be recorded separately rather than inferred from static review.
