# Fresh-city one-shot transaction proofs

Task: SPEC-FRESH-CITY-PROOF-001 / [#1866](https://github.com/anitaguptaoffice/sanguo-slg/issues/1866).
Base main: `84d681785488e26158415b199ad7c635013c76e4`.
Inputs: [application boundary](SLG_COMMAND_BOUNDARY.md),
[fresh marker](MIL_FRESH_COHORT.md), [transaction lifetime](MIL_RECRUIT_TX_LIFETIME.md),
[retained city identity](WORLD_CITY_IDENTITY.md).

This freezes narrow Go proof surfaces and their issuer/consumer discipline, not
participant constructors, an executable coordinator or an activation certificate.
Existing callback/raw-pgx creation paths do not implement this contract. The new
sequence mechanism is only observed identity consistency, not fresh-city proof.

## 1. Selected dependency direction

The fixed business chain is WORLD actual new INSERT and readback, then MIL actual
marker/stock initialization and readback, then DOM staged initialization, then
APP's sole commit. No stage may independently commit or publish a cache.

Use existing packages: `internal/world`, `internal/military/march`,
`internal/domestic`, and `internal/platform/recruittx`.
Narrow credential imports may point DOM -> MIL -> WORLD -> recruittx. APP imports
these participants; none imports APP. No reverse domain import, cycle, generic
callback runner or shared package that can mint arbitrary business success.
Before implementation, recheck actual imports including tests and build tags.

WORLD owns its fresh-insert credential. MIL owns its successful-initialization
credential. DOM may inspect neither private state directly nor a raw transaction.
Only each issuer's package-private implementation may allocate its proof state.
The names below do not grant other packages production constructor authority.

## 2. Concrete proof-only surface

In `world`:

```go
type CityIdentity struct {
    ServerID int32
    CityID int64
    PlayerID int64
}
type FreshCity struct { s *freshCityState }
func (p FreshCity) Consume(ctx context.Context, a *recruittx.Access) (CityIdentity, error)
```

In `march`:

```go
type InitializedCity struct { s *initializedCityState }
func (p InitializedCity) Consume(ctx context.Context, a *recruittx.Access) (world.CityIdentity, error)
```

The snippets freeze exported names, field types and method signatures, not a
permission to add other exported state or constructors. The state types and all
state fields are private. No exported `NewFreshCity`, `NewInitializedCity`, setter,
reset, decode/unmarshal constructor, serialization, raw handle or lifecycle method.
No interface lets an arbitrary implementation impersonate either concrete proof.
Zero values have nil state and fail. Error names are not a new transport contract.

`CityIdentity` is a copied data snapshot, NOT a capability. Its fields are positive
and fixed from actual authoritative rows. Constructing or modifying that struct
cannot create either proof. Downstream initialization accepts the preceding
concrete proof, never just `CityIdentity`, `City`, an integer, `fresh=true`, an
interface claiming success or a callback-returned value. A proof is not persisted
or reconstructed on restart; recovery reads committed facts under its own contract.

## 3. Exact transaction-state identity

Add this narrow mechanism to recruittx through a separate implementation card:

```go
func (a *Access) CheckSameTransaction(ctx context.Context, expected *Binding, other *Access) error
```

It validates both nonzero handles and exact expected Binding, compares their
private shared transaction-state pointers, and checks active lifetime/cancellation
while holding that state's existing serialization gate. No SQL, Begin, raw state
accessor, callback or public token constructor is needed. Different state on the
SAME Binding/pool fails. Different wrappers or value copies referring to the SAME
state are valid aliases, but cannot extend its lifetime. A nil/canceled context,
zero/foreign/ended state or mismatching Binding fails before any success.

Each issuer stores a private VALUE COPY of the actual Access in the proof state,
plus its immutable expected Binding and sealed identity. The copy retains the
opaque shared state without exposing it. Consume calls CheckSameTransaction on
that private captured copy against the supplied Access; neither pointer-address
comparison nor DSN/connection/metadata equality can replace this check.

This is necessary because ordinary Go can overwrite an exported opaque handle
with `*a = *otherAccess` while keeping its address. Retaining only the supplied
pointer could then rebind a proof to another transaction on the same Binding.
A private value snapshot preserves the original state and rejects that substitution.
Consumers likewise snapshot their supplied Access once and use that SAME snapshot
for Consume and every subsequent SQL call, not a mutable caller-owned handle.
Handle overwrite after that snapshot cannot redirect those statements. Concurrent
unsynchronized mutation of Go values remains a data race, not supported usage.

The method reuses existing end linearization; it provides no lasting liveness,
authorization, source/profile or commit certificate. A successful check followed
by transaction end must cause later Access SQL to fail normally. Do not expose
transaction-state IDs, use reflection/unsafe, infer identity from backend PID,
or alter the existing Access SQL/lifecycle surface to perform this comparison.
The prerequisite platform implementation must pass independent review/tests and
CI before any domain code relies on the newly frozen method.

## 4. Shared consumption and races

Each proof has one private shared state pointer containing immutable identity,
private value-copied Access, captured Binding and a synchronized unused/consumed flag. Copying a proof
copies this pointer, NOT its flag. All aliases compete for the same one-shot claim.

Consume validates nil state, supplied context, positive identity
and exact bound live transaction state; then atomically claims unused -> consumed. Exactly one
contender can return the sealed identity. No reset on error, rollback or panic.
After the claim, recheck request cancellation and bound live access before returning
success; if either fails, return no identity and leave the proof consumed. This
second check must not be treated as an atomic through-commit liveness guarantee.
Failures before claiming need not burn a valid proof, but the command must still
abort on any participant/proof error; production must not retry inside that tx.

APP executes stages serially and must not start Commit/Rollback concurrently with
business stage execution. The platform lifetime gate still rejects post-end SQL.
An end/cancellation racing after a successful check can make a returned identity
immediately unusable; it cannot authorize SQL on an ended Access. A consumer must
perform every statement through the same captured live Access/Binding, so it
cannot use the earlier successful Consume as a cached permission for later SQL.

This design guarantees one-shot consumption and denies operations admitted after
transaction end. It does not promise that an operation admitted before end cannot
finish, or that returning a proof establishes a lasting active transaction. Tests
must preserve this distinction instead of asserting impossible end-race ordering.
It is a closed-call-graph contract, not a sandbox against malicious same-process
Go, arbitrary SQL, reflection/unsafe or privileged database maintenance.

## 5. Issuance and consuming-stage obligations

WORLD may mint FreshCity only after its own actual new `player_city` INSERT and
same-transaction readback agree on shard, new retained-safe ID and authenticated
owner. Any insert conflict, unexpected affected-row count or readback mismatch
returns no proof. nextval alone, matching existing city, cache state or legacy
callback success cannot mint it. No UPSERT/adoption/retry with a cached ID.

The immutable WORLD participant must already have validated its source profile,
actor/lock prerequisites, allocator, table metadata and continuous source fence.
The exact participant constructor and complete lock order remain separate gates;
this document does not let arbitrary schema strings or caller assertions satisfy
them. A dormant internal test fixture is not a production profile issuer.

MIL's initialization entry consumes FreshCity exactly once and retains the sealed
identity locally. It must reject any prior marker, troop row, queue/history or
retained recruit-origin/receipt evidence as required by the fresh-cohort contract.
Using its independently bound cohort and trusted canonical processing instant,
it inserts the marker and exactly four zero troop rows, then validates full actual
readback. Only after ALL these steps succeed may MIL mint InitializedCity bound
to that SAME Access/Binding and exact unchanged identity. Merely consuming a
WORLD proof or attempting SQL is not successful military initialization.

DOM's staging entry consumes InitializedCity exactly once, uses its sealed
identity rather than overwriting it from a template/request, and stages only DOM
state through the same Access. It must reject pre-existing initialization and
identity mismatch rather than update/adopt/repair it. DOM returns no public
success credential based only on consumption: its staged result must follow real
DOM writes and readback under its separate stage/publication contract.

Every error after WORLD insertion, marker creation, any troop write/readback or
DOM staging requires APP to end the whole transaction without business commit.
The proof cannot be saved for another transaction or used as a compensation token.
Sequence gaps after rollback are legal; reclaiming the allocated number is not.

## 6. Composition and publication gates still required

If a DOM Hub gate is required, acquire it BEFORE Begin/DB locks, release it on all
paths and never re-enter Hub while holding DB locks. Preserve cloned server-owned
template validation, authoritative wallet reconciliation, one trusted processing
time sample and correct post-commit cache/scheduler publication. The precise DOM
prepare/stage/publish/discard methods require a separate reviewed interface; the
legacy transaction-owning CreateNewCity cannot be wrapped as a participant.

Only APP holds Owner and decides Commit/Rollback. A successful final stage is not
a committed city. Publish only after confirmed commit; commit errors remain
unknown under the existing outcome contract, even if cleanup is attempted.
No blind retry/new city allocation, fabricated absence, refund or cache success.
Without a frozen stable creation-command identity/recovery contract, report
unknown for authoritative reconciliation rather than promise automatic replay.

Profile provenance, complete metadata/role checks, retained ID highwater, source
revocation/DDL/writer fences through commit, actor/wallet/city lock strengths,
compatible legacy writers and restart/restore acceptance remain mandatory before
runtime composition. This file does not silently choose or waive those gates.

## 7. Required implementation evidence

Separate single-domain cards implement issuers and consumers; all spec changes
remain independent. Review exact final source and the combined production call
graph before any live route is changed. Required tests include:
- zero/nil proof, nil context/Access, zero identities and malformed private state;
- same Binding but another transaction, foreign pool/Binding, ended or canceled
  command rejection; same-state wrappers/copies remain valid lifetime-bound aliases;
- overwriting the original Access at the same address with another transaction
  cannot rebind a captured proof or a consuming stage snapshot;
- many copied proof aliases race consumption: at most one success, no reset;
- cancellation/end around both checks and one-shot claim, no post-end SQL;
- actual failed/conflicting insert yields no WORLD proof; readback disagreement
  yields none; a sequence number or matching old city cannot be adopted;
- failure after WORLD, marker, each troop write/readback or DOM causes all business
  rows to roll back; allocated sequence numbers need not roll back;
- only actual complete MIL initialization/readback yields the second proof;
- DOM cannot substitute scope/owner/ID; no cache publication on rollback/unknown;
- commit all stages together, then actual process restart recovers committed facts
  without reconstructing an in-memory proof or accepting stale pre-crash objects.

Pure/unit tests do not prove database atomicity or process-restart durability.
Use isolated PG17 tests with real transaction outcomes and explicit cleanup for
those claims; source/CI success is not production or full-chain acceptance.
Historical reference/art/VERIFY hold, DATA-002 and no-production limits remain.
