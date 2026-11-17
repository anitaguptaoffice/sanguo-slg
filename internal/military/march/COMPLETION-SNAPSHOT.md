# Recruit completion input snapshots

`ApplyDueRecruits` and public `Complete` retain handles across real SQL waits.
Callers must not assume they may rewrite the due slice or the `*recruittx.Access`
wrapper after validation begins.

## Captured inputs

- `Complete` copies `*recruittx.Access` at entry and uses only the private value
  through validation and effect application.
- `ApplyDueRecruits` copies the due jobs before validation, copies `Access` at
  entry, and uses those private values for the WORLD ownership lock and every
  downstream `Complete` / effect read.

Nil or invalid inputs, mixed city/player rejection, disposition semantics, and
terminal no-op behavior are unchanged.

## Verification

`recruit_completion_alias_pg_test.go` uses synchronous pgx trace hooks (no sleeps,
no Go data races) on PostgreSQL 17:

- mutate the caller-owned due element at the WORLD `FOR UPDATE` boundary;
- replace caller `Access` with another active same-`Binding` transaction at the
  WORLD wait (`ApplyDueRecruits`) and the first `mil_city_origin` lock
  (`Complete`);
- commit / rollback variants prove durable ownership stays with the captured
  original transaction;
- invalid-handle checks mirror the adopted Return snapshot guards.

Refs: `spec/rules/MIL_RECRUIT_PORTS.md`, `internal/platform/recruittx/identity.go`.
