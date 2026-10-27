# Recruit transaction ownership and access lifetime

Task: SPEC-RECRUIT-TX-LIFETIME-001 / [#1836](https://github.com/anitaguptaoffice/sanguo-slg/issues/1836).
Baseline: main `da55de65418635e01d3e3f834585d21673acb8f2`.
Inputs: [command boundary](SLG_COMMAND_BOUNDARY.md), [recruit command](MIL_RECRUIT_COMMAND.md),
[queue](MIL_RECRUIT_QUEUE.md), [physical storage](MIL_RECRUIT_STORAGE.md), #1833 / #1835.
This freezes only a narrow Go mechanism for future Recruit participants. It does
not implement a business command, certify a source/epoch, grant database access,
or enable production. Existing live Hub paths remain unchanged until full gates pass.

## Package and dependency direction

Use `internal/platform/recruittx` for this Recruit-specific mechanism, not a generic
command bus, callback runner, migration framework or domain coordinator. APP owns
one concrete binding and each command's owner. Future DOM/WORLD/MIL participants
capture that SAME binding pointer at construction and receive only its access
handle during a command. Dependencies point APP/domain → platform mechanism;
platform imports no application/domain package and executes no business SQL.
Domain participants must not import or call an APP coordinator, Begin, Commit or
Rollback. Enforce this through the reviewed closed production call graph, not a
claim of sandboxing malicious same-process Go, reflection, unsafe or privileged SQL.
Exact business participant methods remain separate domain cards, not invented here.

## Concrete surface

- `NewBinding(pool *pgxpool.Pool) (*Binding, error)` captures the exact non-nil
  concrete pool; no interface store, Begin callback, initializer, raw tx or factory
  injection. Fields are unexported and immutable. A binding is a pool provenance
  capability ONLY, never a readiness, metadata, role, shard or epoch certificate.
- `(*Binding).Begin(ctx context.Context) (*Owner, error)` directly calls that
  captured pool's `BeginTx` with READ COMMITTED. The command context must have a
  deadline; unbounded or already-canceled contexts fail before Begin. A fresh owner
  and shared private state are created for each successful Begin, never pooled or
  reused. No API accepts an existing pgx.Tx or a connection to adopt.
- `(*Owner).Access() *Access` returns a handle to that owner's private state. Owner,
  access and binding zero/nil values are invalid. Copying exported handles cannot
  duplicate transaction lifetime or bypass the shared ended state.
- `(*Access).Exec(ctx context.Context, expected *Binding, sql string, args ...any)
  (pgconn.CommandTag, error)` and `(*Access).Scan(ctx context.Context, expected
  *Binding, sql string, args []any, dest ...any) error` require the exact captured
  binding pointer on EVERY call, not just equality of DSN or metadata. A separately
  created binding around the same pool still mismatches this participant binding.
  Scan performs QueryRow AND Scan entirely inside its access lifetime. Neither
  method exposes pgx.Tx, Conn, Pool, Row, Rows, an iterator or an execution callback.
  No public accessor lets a recipient recover the captured binding from Access.
- Only Owner provides `Commit(ctx context.Context) error` and
  `Rollback(ctx context.Context) error`. Participants receive no Owner. Constructors
  and all production owner/participant call sites must be reviewed before wiring.

The mechanism permits SQL only through bound live Access; domain owners still own
and review their SQL and bind parameters. It cannot determine whether arbitrary SQL
is a debit, a commit statement or a privileged operation. Production participants
must not submit transaction-control/DDL/role-setting SQL, pooled fallbacks or legacy
Hub calls. Source review/call-graph verification is part of the boundary, not optional.

## Lifetime, cancellation and outcome

All access operations and owner ending operations share one serialization gate.
Acquire the gate with bounded cancellation; after acquisition recheck binding,
active state and context before touching the underlying transaction. Keep the gate
through the complete Exec or Scan, including delayed row scanning. An end operation
linearizes only after it acquires this gate and marks the shared state ended; no
new SQL may start after that point. Calling Commit/Rollback while another operation
holds the gate does not itself close admission: an access admitted before the end
linearization may finish first. Commit/rollback waits for those admitted operations
to finish, rather than letting a returned row race an actual end. If an end call
times out before acquiring the gate, it has not ended or committed the transaction;
bounded cleanup remains required, and the original command deadline still applies.
Access SQL must also honor the original bounded command context even if its caller
passes a longer-lived context. A canceled gate wait does not send SQL or commit.

Before calling the underlying Commit/Rollback, permanently mark shared state ended;
every copied/retained access handle and repeated end then fails closed. No reset,
rebind, retry transaction, automatic compensation or cached success is available.
A commit error AFTER the underlying Commit was invoked is wrapped/classified as
`ErrOutcomeUnknown`, never represented as a known rollback. An error before invoking
Commit (ended/binding/context/gate failure) is not an attempted commit outcome.
The coordinator uses the separate same-key wallet-barrier readback contract for
uncertainty; this mechanism does not resolve or replay the business operation.

APP defers bounded cleanup after successful Begin, including error/panic paths.
Cleanup uses a non-canceled context with a short explicit timeout, not the canceled
request. Commit-error cleanup may attempt rollback in the owner mechanism with that
same bounded policy, but must preserve UNKNOWN even if rollback appears successful.
Cleanup timeout/failure is reported as such; an attempted cleanup is not evidence
that an uncertain commit rolled back. No participant receives end/cleanup powers.
The implementation must document exact terminal-state and cleanup behavior and test
it without exposing production test hooks or injectable Begin callbacks.

## Separate mandatory business gates

This mechanism proves only construction-based exact-pool/transaction provenance and
lifetime. Before any business SQL, the future coordinator and participants must
independently validate authenticated actor/shard, current database/schema/role,
relation and sequence identities/privileges, owner/readiness, trusted retained
catalog and cohort/epoch. Hold the approved actor → wallet → city → domain → queue
→ receipt locks and through-commit revocation interlock or drain. None can be
replaced by possessing Binding/Access or by a caller-provided boolean. No target
DDL, grants, legacy adoption, production activation or transport change is approved.

## Implementation acceptance

Test nil/zero bindings/handles, different pool and same-pool/different binding,
ended/copied/reused access, overlapping operations/end, canceled waits, delayed
Scan, original command deadline, panic cleanup and bounded rollback. Tests must
establish no transaction-control methods/raw handles escape to a participant.
Use a fresh isolated PG17 database to prove one actual Begin, statement effects
commit together or rollback together, no post-end SQL, and no second Begin/retry on
commit error. Deterministic unit fault injection stays in package-private test code;
real connection/transport uncertainty must not be claimed proven by a fake error.
Independent source review, focused/race tests, required exact-head CI and main CI
precede source merge. Source success alone does not activate durable Recruit or
prove process-crash recovery, role privileges, source provenance or epoch fencing.
