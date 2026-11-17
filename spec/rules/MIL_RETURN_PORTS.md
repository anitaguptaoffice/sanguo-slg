# SPEC-RETURN-PORTS-001 — proposed return transaction ports

Task [#2095](https://github.com/anitaguptaoffice/sanguo-slg/issues/2095).
Status: **independently reviewed proposal, not yet adopted.**
Adoption takes effect only if and when PR #2096 is merged. No merge is claimed here.
Not implemented or activated. Depends on the adopted
[return-credit contract](MIL_RETURN_CREDIT.md), PR #2094 merged as
`e2dff4987acca09c73187f29a8479c15d540248a`.
AGENTS.md requires independent SPEC review and applicable freeze/notification
steps BEFORE dependent implementation. Adoption does not enable production.
This document prepares interfaces and regression obligations, not executable tests.
No Go, DDL, wire protocol, deployment, held-stack modification or hold release occurs.

Inputs also remain [Recruit ports](MIL_RECRUIT_PORTS.md),
[lifetime](MIL_RECRUIT_TX_LIFETIME.md), [boundary](SLG_COMMAND_BOUNDARY.md).
If a later contract changes #2094 semantics, re-review affected ports and cases.

## 1. Construction and source agreement

APP is internal/api. Domains remain ACCOUNT, DOM, WORLD and MIL; no domain imports
another domain or APP for these ports. Reuse the concrete recruittx.Binding/Access
lifetime, not raw pgx, a generic transaction callback or arbitrary success proof.
APP alone owns Begin/end and the closed call graph. There is one captured binding,
shard, generation lease and reviewed source expectation across all participants.
Every domain copies its exact inventory projection; common identities and all other
profile fields agree. Discovery is not approval. External cohort/enrollment and
writer/retention/DDL exclusions remain required; no boolean attests them.

The following are proposed exact new exported declarations; context.Context,
time.Time, freshsource.Profile and recruittx types retain their package identities.
Existing ACCOUNT RecruitActorGuard, DOM RecruitWallet and WORLD RecruitCityLocker
constructors/Pin/Lock remain unchanged. Their reuse does not claim that the current
partial source validators establish the complete enrollment contract.

```go
// package account: source-bound, unlocked discovery hint, not authorization
func (g *RecruitActorGuard) AccountHint(ctx context.Context,
    a *recruittx.Access, playerID int64) (int64, error)

// package world: companion method on the existing, source-bound locker
// No MIL import or lifecycle method is introduced.
type ReturnOrigin struct {
    ServerID int32
    PlayerID, CityID int64
    X, Y int32
}
func (l *RecruitCityLocker) LockReturnOrigin(ctx context.Context,
    a *recruittx.Access, playerID, cityID int64) (ReturnOrigin, error)

// package march: no WORLD import; APP copies named fields.
var ErrReturnSource = errors.New("march: return source unavailable")
var ErrReturnUnavailable = errors.New("march: return transition unavailable")
type ReturnCandidate struct {
    ServerID int32
    PlayerID, CityID, MarchID, ArmyID int64
}
type ReturnOrigin struct {
    ServerID int32
    PlayerID, CityID int64
    X, Y int32
}
type ReturnDisposition uint8
const (
    ReturnApplied ReturnDisposition = 1
    ReturnCreditedTerminal ReturnDisposition = 2
    ReturnAnnihilatedTerminal ReturnDisposition = 3
    ReturnStillReturning ReturnDisposition = 4
    ReturnEarly ReturnDisposition = 5
)
type ReturnObservation struct {
    Candidate ReturnCandidate
    Disposition ReturnDisposition
    ReturnAt time.Time
}
func NewReturnParticipant(ctx context.Context, b *recruittx.Binding,
    a *recruittx.Access, p freshsource.Profile,
    catalog *RecruitCatalog) (*ReturnParticipant, error)
func (p *ReturnParticipant) Pin(ctx context.Context, a *recruittx.Access) error
func (p *ReturnParticipant) Complete(ctx context.Context, a *recruittx.Access,
    c ReturnCandidate, origin ReturnOrigin) (ReturnObservation, error)
func (p *ReturnParticipant) Readback(ctx context.Context, a *recruittx.Access,
    c ReturnCandidate, origin ReturnOrigin) (ReturnObservation, error)
```

ReturnParticipant has only private state, no public struct constructor, Owner, pool,
raw transaction or generic SQL method. Nil/zero is invalid; copies share retirement.
Constructor captures immutable catalog artifacts needed to validate accepted pending
recruitment, plus the exact 23-object return profile. It never passes that profile
to NewRecruitParticipant, whose frozen inventory has 14 objects. Any private reuse
copies only the approved matching projection without inventing separate retirement.
Validate each pending job against its stored manifest/version/digest, not today's
prices; no admission planner or sequence allocation is used for validation.
All methods validate exact binding, live Access, shard, pinned source and retirement;
constructor success alone is not permission to write or proof of ongoing provenance.

AccountHint is an unlocked, qualified player-to-account read after ACCOUNT pin/source
validation in the captured shard, before any actor row lock. Require positive legal
IDs; absence is unavailable. Existing Lock then locks account before player and
revalidates association. A reassignment aborts/restarts from the beginning, never
locks player first or switches accounts after wallet. The hint proves no authority.
This companion needs a separate ACCOUNT implementation card, not raw APP SQL.

LockReturnOrigin does the same qualified, source-validated WORLD FOR UPDATE owner
lock as Lock, selecting and returning x/y from that locked row in the same statement.
It neither creates a city nor changes coordinates. Retain the row lock through end.
APP checks the returned scope and copies each named field to march.ReturnOrigin.
MIL verifies scope equality and the retained march origin coordinates. Origin is a
plain copied value, NOT a transferable authorization capability; only the reviewed
fixed APP call graph establishes its authoritative same-transaction provenance.
No request, Hub snapshot or scanner payload may supply coordinates to that graph.
A separately scoped WORLD implementation/review is required before MIL integration.

## 2. Pin, row and state semantics

Pin obtains only the eight MIL relation pins, in #2094 order: marker, stock, queue,
recruit origin, recruit receipt, march, army, troops. All are ROW EXCLUSIVE. It checks
the full 23-object metadata/privilege inventory under pins. No row locks in Pin.
APP first pins ACCOUNT account/player, DOM wallet and WORLD city, in that order.

After all pins, APP locks authoritative account/player association, existing wallet,
then WORLD origin. The trusted scanner resolves account association from the source,
then ACCOUNT Lock revalidates it; discovery is not authentication. Return debits
nothing and does not settle production inside this transaction. Complete/Readback
then acquire marker, ALL stock, ALL pending queues, march, army and ALL troop rows
in #2094 row order. No terminal shortcut bypasses WORLD or takes march locks early.
No existing Recruit DoneHistory reuse: its different historical-owner semantics do
not apply here. No Acquire/Begin/commit/rollback/savepoint or Hub lock inside MIL.

Complete validates the locked identity/cohort and entire legal lifecycle. A valid
terminal yields the corresponding terminal disposition without writing stock. A valid
status3 samples PG clock once after locks; early yields ReturnEarly without writes.
Due returning validates all immutable pending recruitment evidence, all four ready/
wounded rows and R+P+S capacity, then atomically writes credit and terminal state.
All affected counts and actual readback values must match before ReturnApplied.
No survivors, counts, current-ready value, timestamp or rule authority comes from a
caller. ReturnApplied is strictly provisional until APP confirms the outer commit.
Zero disposition, contradictory observation or nonnil error is never usable success.

Readback uses the SAME source, authorization, city/march serialization and retained
identity, but does NO business writes. It may return credited-terminal, annihilated-
terminal, still-returning or early, NEVER ReturnApplied. After locks serialize the
old transaction, a complete valid status3 means no prior return credit committed.
Early is the same retained returning lifecycle with a future deadline, not terminal.
Terminal classification does not reapply current admission/capacity limits to undo
history. Current stock is not evidence of historical credit and is deliberately not
returned by this port; a later reviewed hydration path obtains current stock.
ReturnAt preserves the exact retained instant in UTC without rounding or rejecting
otherwise valid sub-millisecond persistence. It is zero only for validated
annihilation. No mutable slices, hero release token or stock-addition delta escapes.

Any malformed/missing/foreign identity, broken cohort, contradictory terminal graph,
source drift, capacity failure or SQL failure returns a nonnil error and an unusable
zero observation. APP rolls back on ANY participant error; continuing to commit after
an error is outside the supported call graph. Definitive source drift retires the
whole generation via APP coordination; transient errors do not prove source drift.
Definite source mismatch uses ErrReturnSource; invalid business/evidence state uses
ErrReturnUnavailable. Wrapped SQL/context failures preserve their causes; errors are
not permission to replay. No public ready boolean or independently committed claim
is accepted; AccountHint is only discovery preceding the mandatory locked recheck.

## 3. Fixed coordinator and uncertainty

For one candidate: acquire generation lease; bounded Begin; pin all domains; validate
actor/account; lock wallet; LockReturnOrigin; copy/check scope; Complete; exactly one
outer Commit after a valid result. Publish only after confirmed outcome and transaction
end, and release lease only under the existing cleanup/unknown-drain discipline.
Terminal/early no-effect observations also require successful transaction end before
being reported. Account rejection or source failure cannot disclose foreign history.

On any error before invoking Commit, rollback with bounded independent cleanup. A
failed cleanup does not prove server rollback. If Commit was actually invoked and
returns an error, classify UNKNOWN, retain the exact candidate and source generation,
end old Access and attempt bounded cleanup. Never convert unknown to rejection, stock
addition, hero release, refund, retry with a new identity or a second Commit attempt.
Local Owner ended, context cancellation and pgx.ErrTxClosed do not resolve the server.

Recovery is a narrowly controlled operation of the unresolved generation, not reopened
business admission: fresh bounded transaction on the same approved source, full pin/
actor/wallet/WORLD order, then Readback. The WORLD and march locks wait for the old
conflicting writer; inability to acquire/revalidate them leaves outcome UNKNOWN.
Successful readback transaction end plus credited/annihilated terminal resolves the
retained state with no credit. Still-returning/early permits a separately bounded
attempt of the SAME identity only after resolution, rechecking all current rules.
Readback itself never retries Complete. Missing evidence never authorizes replay.
If readback end is uncertain, retain uncertainty and repeat readback, not the mutation.
Unknown work remains counted through drain until independent server resolution.
The existing controller has no recovery admission or clear-unknown API. This text
does not reopen it: a separately reviewed APP/lifetime recovery design is required;
serialized readback alone does not mutate the current controller into drained state.

Post-confirmation Hub publication is a separate card: invalidate/reload or generation-
ordered authoritative snapshots, never add historical survivors to mutable cache.
HERO release is separate, all linked heroes and recoverable failures; this port neither
reads player_hero nor produces a release capability. Cache failure cannot undo a
committed transition. No mutex/PG inversion; no production coordinator is added here.

## 4. Regression obligations and adoption gate

Future independently registered implementation cards must demonstrate:
- Wrong Binding, ended/copied Access, nil/zero/copy-retired participant, profile/catalog
  mutation and drift; wrong scope or forged origin never accepted by the fixed APP path.
- WORLD source/owner/coordinate checks and concurrent ownership change held through end;
  exact row/pin order in completion AND readback, including terminal and error branches.
- Ordinary/race real PG17: due, early/clock reversal, terminal duplicate and annihilation;
  legal wounded preserved; missing/extra/negative stock and malformed survivors rejected.
- Pending reserved capacity, including R+S fits but R+P+S exceeds int32; all pending pages,
  accepted evidence and concurrent recruit admission/completion/return under city locks.
- Independent connections racing same identity: one committed addition, retained graph
  unchanged on duplicates; no dropped valid pending work or unrelated city obstruction.
- SQL failure after each provisional write and actual deferred outer-Commit failure:
  independent observer sees neither partial credit nor terminal. Do not equate this
  rollback test with lost acknowledgement or a still-running server transaction.
- Controlled lost acknowledgement after actual commit AND a known-not-committed branch;
  readback blocks behind the old writer, performs zero writes, and only then resolves.
  Barrier timeout/ownership loss/deleted evidence remains unknown with no speculative retry.
- Separate-process death before commit and after known commit before publication; new
  process hydrates authoritative state without double addition. Record PIDs, barriers,
  rows, cleanup and exact source. PG-server restart needs separate explicit evidence.
- Full closed APP composition, cancellation, unresolved drain, restart discovery and
  rejected foreign candidates; mock participant returns cannot prove durable correctness.

This SPEC PR can only validate prose/scope/links and repository CI. It cannot claim the
above runtime, concurrent, process or recovery tests passed. #1953 stays blocked until
both contracts are adopted/notified and exact single-domain component scopes are ready.
Separate ACCOUNT, WORLD, MIL, APP, HERO/hydration implementations and final combined source/writer
compatibility audit remain required; no component or isolated fixture enables production.
Existing #1980/#1983 and historical holds remain unchanged. No freeze waiver is implied.
