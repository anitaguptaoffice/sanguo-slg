# API-REPAIR-005 — return deadline serialization

The existing MarchSummary contract specifies zero for return_finish_at_ms
outside RETURNING. The API now emits a Unix-millisecond deadline only for a
RETURNING order with a nonzero ReturnFinishAt. Zero Go times and residual
deadlines on all other phases serialize as 0.

This is a response-only correction shared by StartMarch and ListMarches.
It does not change phase transitions, march duration, persistence, or add
recall/return behavior. Depart/arrival times and all other summary fields
remain unchanged.

The table test covers all recognized phases, unspecified/unknown phases,
zero/real/epoch times, both response binary round trips, unchanged fields,
nil orders, and no domain input mutation.

Validation on final server baseline 1c5a091:
- The marching/zero regression fails before the fix with -62135596800000.
- go test -race -short ./internal/api -count=1: PASS.
- go test -short ./... and go vet ./...: PASS.
- go build -buildvcs=false ./...: PASS (worktree VCS stamping disabled only).

These serializer tests require no database. Short-mode suites do not replace
real PostgreSQL integration or browser verification on the assembled candidate.
