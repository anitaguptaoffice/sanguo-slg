# Fresh-city participants, source enrollment and operational drain

Task: SPEC-FRESH-CITY-PARTICIPANTS-001 / [#1870](https://github.com/anitaguptaoffice/sanguo-slg/issues/1870).
Base: `d2c745512c9bd0f254d321766cd3a094d959f107`.
Inputs: [proofs](FRESH_CITY_PROOF.md), [city allocator](WORLD_CITY_IDENTITY.md),
[fresh marker](MIL_FRESH_COHORT.md), [storage](MIL_RECRUIT_STORAGE.md),
[application boundary](SLG_COMMAND_BOUNDARY.md), [lifetime](MIL_RECRUIT_TX_LIFETIME.md).

This selects source enrollment, operational drain and the fresh-create ordering.
It enrolls no real database, issues no activation evidence and deploys no writer.

## 1. Independent expectations, not discovery as approval
The deployment owner supplies a reviewed, immutable startup profile BEFORE any
runtime source inspection. It identifies the exact release/spec/artifact digests,
cluster/deployment reference, database name/OID, literal application schema/OID and
owner OID, current/session role names AND OIDs, positive shard, nonzero 16-byte
cohort, and exact relation/index/sequence OIDs and owner OIDs for this release.
Each participant defensively copies the relevant values and shares the exact
same concrete recruittx.Binding with APP. Strings and nested maps/slices must not
remain caller-mutable. Actual table shape is checked against reviewed code/spec
constants, not a caller-provided arbitrary shape or mutable database template.

The profile references separately retained owner-approved activation/audit records
by stable identity and content digest. Those records cover complete retained city
and queue highwater/history, coherent restore provenance, release compatibility,
fresh-cohort audit and external writer/DDL/retention exclusion arrangements.
The baseline audit also covers complete actor/wallet initialization history: every
previously initialized wallet remains present, restore preserves actor/wallet
coherence, and certified writers never delete/reset initialized wallets. Maintain
that invariant through continuous external retention/restore and writer exclusion.
Missing history or inability to establish it leaves enrollment unavailable.
A digest establishes integrity against the expected bytes, not authorization or
truth of their assertions. The deployment owner independently establishes that
provenance and keeps the exclusion effective; the program cannot infer it from
empty tables, a manifest, the profile itself or successful catalog queries.

Select trusted, reviewed startup configuration as the enrollment input channel.
No client/request/GM endpoint may supply or replace it. No `approved=true`, valid
flag, arbitrary success callback, observed-stamp-to-profile conversion or automatic
recapture is an enrollment path. Startup assembly must verify it is loading the
expected reviewed record/release identities; missing, changed or unverifiable
inputs leave the new path disabled. This does not introduce an in-app signer.

Concrete constructors accept the captured Binding, startup validation Access and
copied expected profile; they perform no Begin/Commit, DDL, grants or repairs.
APP owns the bounded validation transaction and discards all participants if any
validation or transaction ending fails. Constructors compare actual database,
namespace, role, owner, object identity/shape and actual required privileges to
independent expectations. Matching observations establish local consistency ONLY.
Role or object replacements, wrong shape, missing rights or unknown dependencies
fail, never reset expectations to the new observed values.

Later per-command pin/validation repeats these comparisons before business SQL.
Use exact literal schema lookup and fully qualified SQL/catalog operations;
never parse a raw schema string as an unquoted identifier or trust search_path.
Preserve caller settings. Review approved existing FK/default/index semantics;
reject unreviewed RLS, triggers, rules, inheritance/partitioning or extra objects.
Do not reject the explicitly reviewed account FK triggers merely because a
blanket 'no triggers anywhere' shortcut is easier to implement.

## 2. Local admission and named external responsibility
APP owns one concrete source admission controller per enrolled source generation.
PLATFORM may implement its narrow synchronization mechanism; no domain receives
lifecycle control, mutable controller state or a reopen capability. Constructors
capture the same generation's immutable participant/binding/profile set.
The startup assembly publishes it only after all local validations and required
external enrollment prerequisites are established. No independently published
partial participant, fallback memory store or mixed-generation combination.

Before Begin, APP acquires a generation-bound lease. Acquisition atomically rejects
closing, closed or poisoned state and increments admitted work; lease copies share
one completion state. No callback can declare the lease or source valid. APP keeps
the lease through all participant operations, transaction ending, outcome
classification and bounded cleanup. Domain proof possession does not replace it.

Choose irreversible close-and-drain, with NO online reopen/rebind. Close first
atomically stops new admission; existing admitted commands retain their lease and
may finish before drain is declared complete. Only after every admitted server
transaction is known ended may the controller report drained/invalidation complete.
A close request is not yet completed invalidation. This distinction must be explicit
in tests/logs, rather than promising no commit after the instant close was requested.

Confirmed Commit success, confirmed Rollback success, or failure before actual
Begin can resolve that work item. Commit error, failed/uncertain rollback or lost
server connection must poison/close admission and leave drain UNRESOLVED unless
server transaction resolution is independently established. Releasing a local
lease, marking Owner ended, cleanup attempt, context cancellation or process exit
alone does not establish PostgreSQL completion. Do not decrement unknown work
into a false 'drained' result. No timeout silently changes unknown into resolved.

The deployment owner must keep incompatible old binaries, GM/import writers,
standalone nextval/setval, DDL, retention/deletion and restore operations excluded
through the last possibly live admitted transaction. The local controller cannot
fence external SQL or attest those controls. On external uncertainty, close local
admission and retain the external exclusion; never proceed with maintenance on a
mere local-zero counter. Reopening requires a new reviewed process startup after
renewed coherent audit/provenance and verified server termination/resolution of
the old generation. No public runtime 'clear unknown' or replacement-profile API.

Source-only isolated tests use explicitly owned fixtures and controlled exclusions;
they test local behavior without issuing production activation evidence.

## 3. Fixed command ownership and preparation
APP holds concrete ACCOUNT, DOM, WORLD and MIL participants built from the same
Binding/source generation. No interface substitution, Begin function, raw pgx.Tx,
initializer callback or business-success factory enters the production command.
The sole APP coordinator uses Binding.Begin, obtains Access, immediately retains
a private value snapshot and passes snapshots referring to that exact state.
Use CheckSameTransaction and the one-shot proof discipline from the proof contract.

Order before Begin:
1. Authenticate using the existing trusted session binding; require positive
   account/player/shard and exact requested shard. No AccountID0 compatibility.
2. Validate typed request and copy trusted server-owned initial DOM template and
   building catalog; do not retain request-owned mutable maps or fields.
3. Acquire source lease, then cancellable DOM Hub preparation gate. No PG locks
   may be held while waiting for this gate. Release gate/lease on every path.
4. APP begins one bounded READ COMMITTED transaction. Install bounded cleanup
   immediately; failures and panic do not leak it. No nested legacy save call.

DOM preparation is not city initialization or a database commit. It validates and
clones the template, preserves the reviewed initial resources/buildings and rejects
nil/invalid states or nonzero CityState.ID. Require empty BuildJobs and no in-progress building upgrades
or scheduled upgrade timestamps, matching the current fresh handler template.
Reject these inputs rather than silently clearing them; this path allocates no
construction queue jobs. It must neither publish a new city nor settle a wallet through
a separate transaction inside this command. This path initializes a new city;
existing-city settlement and old state adoption are not repurposed as preparation.

## 4. Relation pins, actor, wallet and creation locks

Acquire transaction-held relation pins before business row/advisory locks in this
fixed order, with each concrete participant issuing only its reviewed SQL:
1. ACCOUNT: account, then player, ROW SHARE.
2. DOM: player_wallet, ROW EXCLUSIVE.
3. WORLD: map_cell ROW SHARE, then player_city ROW EXCLUSIVE.
4. MIL: mil_city_origin, city_troop, work_queue, ROW EXCLUSIVE, then
   mil_recruit_origin and mil_recruit_receipt, ACCESS SHARE.
5. DOM: city_production_checkpoint, then city_building, ROW EXCLUSIVE.

Each name is explicitly schema-qualified and revalidated against expected OID and
fixed shape after pin acquisition. Reject missing/changed objects before proceeding.
Pins do NOT replace external DDL exclusion or fence setval; do not LOCK TABLE a sequence.
All participants acquire pins in this order; no later reverse-order pin acquisition.
Required role rights must actually exist, including row-lock rights; never grant
or escalate them automatically. This is a new-path order, not certification of
unexamined old writers or simultaneous schema maintenance.

Then acquire business locks and effects in this exact sequence:
1. ACCOUNT locks the authenticated account row FOR SHARE and verifies status1;
   then the exact `(server_id, player_id)` player row FOR SHARE, verifying its
   account_id equals authenticated AccountID. These strengths block ordinary status/link changes through commit.
   Do not upgrade player to FOR UPDATE after wallet acquisition.
2. DOM prepares the actor wallet: preserve an existing authoritative wallet without
   overwriting it from template values; if genuinely absent, INSERT initial values
   with the existing same-actor unique conflict discipline, then SELECT FOR UPDATE.
   Eligibility for this first initialization requires the preserved enrolled
   actor/wallet invariant above. A missing row/current city count is not proof;
   uncertain, deleted or partially restored history closes the source and MUST
   NOT receive template funds. No wallet repair or reconstructed balance.
   Validate actual nonnegative/bounded values and retain the lock. This is wallet
   preparation, not the later new-city DOM initialization. All effects remain in
   APP's transaction and roll back if any later stage fails.
3. WORLD takes its existing two-int shard creation advisory lock (`CITY`, server_id),
   then locks the requested map_cell FOR UPDATE and validates in-bounds buildable
   terrain/resource state. Distinct actors targeting one coordinate serialize on
   that cell; the player_city unique constraint remains a final defense.
4. Revalidate bound sequence/source admission conditions, allocate a positive
   retained-safe sequence ID (never MAX+1), then actual player_city INSERT with
   exactly one affected row and readback of sealed identity/owner and requested
   world fields. Any conflict or mismatch aborts; no adoption or cached-ID retry.
5. WORLD mints FreshCity only now. MIL consumes it, rejects all forbidden retained
   state, inserts marker and four zero stocks, validates actual full readback,
   and only then mints InitializedCity as specified by the fresh-cohort contract.
6. DOM consumes InitializedCity and initializes its own checkpoint/building state
   with that exact identity; no second actor/wallet lock or identity substitution.
   Reject pre-existing domestic state rather than delete/reinsert or adopt it.

FOR SHARE on the player is deliberate: it protects account linkage without the
unnecessary early FOR UPDATE that would conflict with later compatible legacy
FOR SHARE reads while waiting on a wallet. Nevertheless every coexisting writer
must be reviewed against the complete order. In particular old MAX+1 creators,
wallet->actor upgrades, reset/import and incompatible flushers must be excluded;
legacy methods are not certified merely because one lock happens to be compatible.

After row/source validation and before new-city writes, sample authoritative DB
time once and normalize to canonical UTC milliseconds in the existing legal range.
Use the same retained sample for marker and domestic creation checkpoint. Do not
sample a second clock during DOM staging or silently normalize malformed readback.
WORLD player_city.created_at keeps its existing schema semantics; do not claim its
legacy default is the marker's canonical processing sample or change that default.

## 5. Concrete participants and lifecycle surface

Use concrete ACCOUNT (`internal/account`) ActorGuard, WORLD and MIL
FreshCityParticipant, and DOM FreshCityParticipant, with private immutable state.
Shared startup data lives in `internal/platform/freshsource`; it is DATA, not an
approval/lease certificate, and that package executes no domain business SQL:

```go
type ObjectIdentity struct { OID, OwnerOID uint32 }
type Profile struct {
    ReleaseDigest, EvidenceDigest [32]byte
    ClusterRef, EvidenceRef string
    DatabaseName, SchemaName, CurrentRoleName, SessionRoleName string
    DatabaseOID, SchemaOID, SchemaOwnerOID, CurrentRoleOID, SessionRoleOID uint32
    ServerID int32
    Cohort [16]byte
    Objects map[string]ObjectIdentity
}
```

Objects keys are the exact fixed table/index/sequence names required by the
reviewed release, never caller-chosen SQL paths or shape overrides. Nonempty
references/names and nonzero digests/OIDs/cohort are necessary but not sufficient:
section1 validation and independent provenance remain mandatory. Constructors copy
the map and profile. A profile value by itself can mint no fresh-business proof.
APP's admission controller may remain private APP code; no generic public
controller framework or caller-asserted business outcome interface is required.

Freeze these concrete exported constructors, each returning its named concrete
participant pointer plus error; parameters are `(ctx context.Context,
b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile)`:
- ACCOUNT `NewActorGuard` returns `*ActorGuard`.
- WORLD and MIL `NewFreshCityParticipant` return their own `*FreshCityParticipant`.
- DOM `NewFreshCityParticipant` takes those parameters plus `h *Hub` and returns
  its `*FreshCityParticipant`; reject nil or mismatched shard/source wiring.
DOM captures that exact Hub, its store/pool pointers and a copied trusted catalog.
APP establishes correspondence using the captured pool and existing same-pool/shard
Hub check before enrollment. DOM checks captured wiring remains unchanged; no
setter, hidden global or per-request Hub/catalog replacement is permitted.

The following are exact method signatures; `ctx` is context.Context and `a` is
*recruittx.Access throughout. Fields stay private; no Store/Begin callbacks:
- ACCOUNT `Pin(ctx,a) error`; `LockActor(ctx,a,accountID int64,playerID int64) error`.
- WORLD `Pin(ctx,a) error`; `Insert(ctx,a,intent City) (FreshCity,error)`.
- MIL `Pin(ctx,a) error`; `Initialize(ctx,a,city world.FreshCity,at time.Time) (InitializedCity,error)`.
- DOM `Prepare(ctx,initial *CityState) (*PreparedCity,error)`;
  `PinWallet(ctx,a) error`; `PinCityState(ctx,a) error`.
- DOM PreparedCity `LockWallet(ctx,a) error`;
  `Stage(ctx,a,city march.InitializedCity,at time.Time) (world.CityIdentity,error)`;
  `Publish() error`; `Close()`.

DOM PreparedCity owns the preparation gate, copied template and private staged
result; no exported constructor/fields. Close is idempotent, releases gate once,
discards unpublished work and cannot roll back DB state. Closed handles reject
LockWallet/Stage/Publish. Stage/Publish are each
one-shot; Publish is called only by APP after confirmed Commit, never from a
participant or caller-supplied success flag. The reviewed APP call graph enforces
that timing; Publish is not a mechanism that independently proves commit success.
Retaining/copying handles cannot reset state. LockWallet is one-shot and captures
a private Access snapshot; Stage requires it and CheckSameTransaction against
that snapshot, preventing wallet preparation in one tx and initialization in another.

All participant methods validate the captured positive shard and exact scope.
ACCOUNT actor IDs come from trusted authentication; WORLD intent has CityID0 and
matching actor/shard; DOM template owner must match that same actor. APP compares
these before SQL and verifies sealed identities between stages. A mutable returned
CityIdentity cannot replace the preceding concrete proof. All SQL uses private
Access snapshots and the expected Binding; no participant owns transaction ending.

APP calls owner.Commit only after all stage identities and effects agree. On
confirmed commit it asks DOM to publish the owned staged state while the already
held preparation gate still prevents concurrent incompatible Hub changes. Publish
is no SQL, no wallet debit, no mutation callback and no second transaction. It may
register caches/scheduler data only for the confirmed committed staged identity.
Failure to publish does not reverse the DB commit: invalidate/reload through a
reviewed recovery path, report the cache issue and do not rerun creation.

Before confirmed commit, errors discard all staged state and invoke bounded
rollback; no cache/scheduler publication. Unknown outcome keeps publication
suppressed, closes admission and follows unresolved-drain discipline. Without a
stable creation-command identity/recovery contract, do not blindly create again,
refund or infer absence from a transient miss. This card adds no new wire protocol.

## 6. Implementation sequence and evidence

Separate single-domain cards implement the admission mechanism, immutable domain
bindings/metadata checks, actor/wallet preparation, actual WORLD issuer, MIL init,
DOM stage/publication, then fixed APP composition. Concrete source code may be
implemented and exercised against fresh owned fixtures before a target profile
exists; no live source is enrolled or enabled by those test expectations.
Do not mint FreshCity from a nonvalidated arbitrary-schema insertion helper and
call dormancy a substitute for the selected constructor/ordering requirements.

Require ordinary/race tests for immutable snapshots, wrong binding/generation,
close-versus-admit, repeated/copied lease completion, pending unknown drain,
cancellation while waiting, timeout and no online reopening. Real isolated PG17
must verify metadata replacement/role mismatch, actual two-creator contention,
all-stage rollback at each failure boundary, no existing-state adoption, exact
readback and cache suppression. Privilege mutation is not implicitly authorized.
Test actual commit uncertainty and unresolved server transactions separately;
a fake error or local cleanup counter cannot establish authoritative termination.

Before live composition, independently review all caller paths and writer inventory,
verify each final component plus combined chain, and run actual process-restart
acceptance. Preserve all source/CI/PG evidence and failed attempts. Source merge
is not production, old-data migration, full Recruit durability or art acceptance.
Historical reference/art/VERIFY hold, DATA-002 and no-production limits remain.
