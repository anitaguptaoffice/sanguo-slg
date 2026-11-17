# First-city V2 wire and canonical intent

Registered SPEC-CITY-CREATION-WIRE-001 (#2442); not adopted or active.
Depends on CITY_CREATION_RECOVERY.md, FRESH_CITY_PARTICIPANTS.md and
WORLD_CITY_IDENTITY.md; their physical authority, finalizer and retention gates
remain binding. This document freezes public representation, not physical SQL.

## 1. Surface and compatibility

Use the existing binary WebSocket ClientPacket/ServerPacket, not JSON or gRPC.
Text WebSocket frames never dispatch these routes; retain the native frame type.
The new package is sanguo.world.v2; its four route comments name exact methods.
It extends legacy route examples while keeping the common.v1 envelope unchanged.
SubmitFirstCity, ContinueFirstCity, GetFirstCityResult and DiscoverFirstCityIntent
have distinct request/response messages. There is no service declaration because
native dispatch uses route strings. Legacy world.v1.CreateCity and all v1 bytes,
normal multi-city behavior and ListPlayerCities semantics remain unchanged.
Operation is the exact ASCII string world.first_city, operation_version is 2,
and canonical_version is 1. They are server constants, not caller selectors.
Future versions never reset the slot or permit reuse of a retained command ID.
A route name/version does not certify capability, source or a target realm.
No fallback from failed/unknown V2 to legacy creation is permitted.

## 2. Authority and scope expectations

Discovery authenticates the packet session, selected shard and current player.
The server independently obtains active account/account_id and player binding
from ACCOUNT and the retained source's enrolled realm mapping. All IDs must be
positive: server_id <= 2147483647, player/account/city IDs <= 9223372036854775807.
Envelope server_id must be present, positive and exactly the authenticated shard.
An unavailable account ID or player context never uses zero/legacy compatibility.
Every operation revalidates authority; session cache or an old entry response is
not enough. Immutable account binding is checked for head and historical results.
Account change/rebind, expired authority or expectation mismatch rejects this
packet without reading another actor's records or modifying its pending command.

Scope in responses is server-derived. expected_scope in submit/continue/result
is solely an untrusted equality guard copied from a current authenticated
Discovery response. It must exactly equal independently resolved scope; it never
selects an account, player, source or realm. There is no trusted actor, approval,
proof, session, template choice or client hash inside the request payload.
The session stays in the envelope only and is never canonical or persisted here.
Discovery needs no scope input, creates nothing and cannot grant execution.
All records within one response have its identical authorized scope. Lookup is
scoped by realm/server/player/command ID, with immutable account binding checked.
A foreign/nonexistent ID both yields scoped NOT_OBSERVED, without foreign data.
The same command UUID cannot be reused under a different operation/version in
that actor namespace. Clients must never transplant saved IDs into another scope.

realm_id is a canonical UUIDv4 assigned once by trusted realm enrollment, stable
across binaries, source generations, restoration and process restarts. It is not
a database/schema name, a session token or an isolation proof. No such enrolled
entity exists in the inspected runtime; missing mapping returns unavailable.
The physical realm/anchor/fencing contract must bind actual cluster/database/
schema, actor/shard, relation, allocator and writer authority before activation.

## 3. Typed values, presence and closed binary grammar

Command, predecessor and realm UUIDs are 36-byte lowercase ASCII UUIDv4:
8-4-4-4-12 hex, version nibble 4 and variant nibble 8/9/a/b. Reject uppercase,
braces, whitespace, alternative versions and nil; never normalize aliases.
Generate command IDs using a cryptographic RNG before sending, save the complete
intent first, and never reuse accepted or uncertain IDs. UUIDs are non-secret
correlation, never bearer authority. No clock, counter, coordinate or payload hash
substitutes for the RNG. Predecessor and new command IDs must differ.

Proposal requires command_id, predecessor, name, x and y. Every optional name/x/y
must actually be present; omitted, empty name and explicit zero are distinct.
Name is strict UTF-8, 1..32 Unicode scalar values, at most 128 bytes, without NUL.
Reject unpaired UTF-16 surrogates before TS encoding and invalid UTF-8 before
protobuf decoding; do not accept replacement-character repair of invalid bytes.
Do not trim, case-fold or Unicode-normalize. Literal valid U+FFFD remains valid.
Both coordinates are integers 0..499; explicit (0,0) is actual (0,0), no fallback.
Predecessor has exactly one arm: empty {} or rejected_command_id with exact UUID.
Neither absent predecessor nor absent oneof is EMPTY. Rejected ID names the exact
current durable rejected head; no boolean/canceled flag or arbitrary old ID works.

Each record requires canonical, template and exactly one state arm. pending {}
is durable PENDING; succeeded and rejected_no_effect are the only terminal arms.
Each head requires exactly one arm: empty {} or command. Empty markers must have
zero nested bytes. Missing wrappers/state/head are invalid, never absence proof.
All outcome scope/kind/requested ID/head fields are required and validated;
command presence follows section 5. Zero/unknown enum values are invalid.
Success requires positive actual city/server/player IDs and present is_capital,
wall_level and morale. world.first_city operation_version 2 requires exactly
is_capital=true, wall_level=1 and morale=100 in the actual INSERT/readback and
immutable retained success receipt. These constants are outside C1 and FCT1;
later defaults cannot change them. Actual server/player, name and coordinates
must exactly match the canonical scope/proposal. Never reconstruct these
original creation fields from a newly loaded current city.

For these routes only, validate raw envelope and recursive payload before lossy
protobuf decoding: each known singular field occurs at most once, including
messages/oneofs and equal duplicates. Reject unknown fields, extra oneof arms,
wrong wire types, groups, tag zero, truncation, overflow, nonminimal varints,
trailing bytes and integer/bool aliases (bool only 0 or 1). Field order may vary.
Check lengths before allocation. Maximum nesting is 8, request payload 2048 bytes,
request envelope 4096 bytes and response data 16384 bytes. trace_id is 1..64
printable ASCII bytes, for correlation only; session_id obeys existing auth and
has a 128-byte wire cap. Envelope route/session/server must be present; an empty
Discovery payload may omit envelope payload. Envelope trace must be present.
Response grammar is equally strict; malformed/unknown response becomes caller
UNKNOWN without replacing any retained intent or terminal result.
These are route-specific new requirements; legacy decoder behavior is unchanged.
A typed proto.Unmarshal alone cannot detect duplicate fields after merging.

## 4. Canonical encoding and immutable template

The server rebuilds the canonical object from validated typed proposal, trusted
scope and fixed operation/version, then compares ALL fields/bytes with retained
content. No caller-supplied canonical bytes or hash is accepted. Protobuf's field
ordering, JSON property order and deterministic Marshal are not this encoding.
Canonical C1 is the following concatenation, with no padding or omitted values:
1. ASCII SGFC; u16be canonical_version (1).
2. u16be operation UTF-8 byte length (16); ASCII world.first_city.
3. u32be operation_version (2); realm UUID's 16 network-order octets.
4. u32be server_id; u64be player_id; u64be account_id.
5. Command UUID's 16 network-order octets.
6. u8 predecessor tag: 0 for EMPTY; 1 followed by 16 rejected UUID octets.
7. u16be name UTF-8 byte length; exact name UTF-8 bytes.
8. u16be x; u16be y. End of input; no extension bytes.
All u64 inputs remain within positive signed-int64 range. Canonical maximum is
231 bytes. Order/width are fixed; same typed values produce identical C1 bytes.
Name normalization changes, actor/version/predecessor changes and coordinate
changes produce different intent, even if a digest collides. Compare full content.

Template is NOT caller intent. On first durable intake the server atomically
retains C1 plus a complete immutable template snapshot and its TemplateRef.
Version labels are 1..64 ASCII [A-Za-z0-9._-], content_encoding_version is positive
uint32, and content_sha256 is exactly 32 bytes of SHA-256 of the retained content.
Rules/catalog versions identify retained recoverable inputs, not mutable names.
A separate server-template content contract must freeze that private encoding,
full initial resources/buildings/catalog and empty-job constraints before storage
or execution is ready. snapshotFreshTemplate alone supplies no durable decoder.
Duplicate submit/continue compares the old C1 and uses the old template; it never
compares against, replaces with or reevaluates the current release's template.
Missing bytes/old decoder or inconsistent digest/version means unavailable and
retained PENDING, never default initialization or durable rejection. The hash is
an integrity check; it replaces neither full content nor source authorization.

## 5. Operation results and execution

ServerPacket.code=0 means a valid protocol response, NOT city/business success.
Only a succeeded record proves committed original creation. Do not attach a
create-city gameplay event or resource publication merely to code=0.
Get and Discovery are read-only authoritative primary reads: no intake, claim,
execution, template replacement, head change, cache recovery or publication.
Outcome head and optional requested record form one consistent authorized view;
physical locking/isolation must later prove this without inventing empty history.
If command and head have the same UUID, their complete records must be identical.
COMMAND has the retained requested record. ID_CONTENT_CONFLICT has that original
record, never the conflicting proposal. Both have its exact requested UUID.
HEAD_CONFLICT has no requested record and returns the actual current head,
including certified EMPTY when the caller supplied a nonexistent predecessor.
NOT_OBSERVED has no requested record and may have EMPTY or a committed own head.
Not observed/EMPTY only describe this read; neither proves an old packet failed.

Submit validates a complete proposed intent and compares exact existing ID first.
Existing same ID/same C1 returns COMMAND without new intake or automatic execution;
existing different C1 returns ID_CONTENT_CONFLICT and does not mutate anything.
For a new ID, EMPTY only competes against certified never-accepted actor lineage;
a successor requires the exact current REJECTED_NO_EFFECT head. PENDING/SUCCEEDED,
retained history and stale predecessors cannot be replaced: return HEAD_CONFLICT.
Successful intake atomically retains PENDING+template and advances the slot.
Only this invocation's confirmed newly accepted same ID may then attempt its
explicitly requested effects; duplicate submit is read-only. If it cannot safely
start effects, return confirmed PENDING or unavailable, retaining the same ID.
Submit never returns NOT_OBSERVED as a substitute for a failed/uncertain intake.

Continue supplies the original complete proposal plus equality-only scope.
Unknown ID returns NOT_OBSERVED without creating it. Different C1 conflicts.
A known terminal returns COMMAND with original terminal state, regardless of
later head movement. An exact pending current head may execute through a fresh,
valid admitted source and the frozen transaction/lifecycle path. A pending record
that contradicts current head/history makes the source unavailable, not repair.
Repeated concurrent continues serialize; they cannot create repeated effects.
Continue never consumes approval booleans or public proof; explicit UI action
selects this operation, while trusted server authority still controls every phase.

Get returns COMMAND or NOT_OBSERVED, not content/head conflict. Discovery returns
current head or explicit EMPTY only after certified complete-history checks.
Known local intent/head must retain ID and content through miss/timeout/EMPTY.
Only no-local-intent/no-known-head permits a new explicit INITIAL/EMPTY proposal.
A different winner is displayed using its actual canonical name and coordinates;
this submit/lookup/discovery does not execute it. The user must act again on
Continue with that exact winner. Rejected successors require a new explicit
proposal/new UUID/exact rejected head; historical rejected replay cannot rewind it.
A success receipt remains historical after rename/deletion/conquest; entry checks
current ownership independently. No receipt, missing city or cleared browser
storage restores first-city eligibility. Old responses stay in their old scope.

## 6. Packet errors and durable rejection

10001 COMMON_INVALID_PACKET: invalid grammar, fields, ranges or unsupported shape.
10002 COMMON_UNAUTHORIZED: invalid/currently unauthorized scope or expectation.
10003 COMMON_UNAVAILABLE: source/history/template unavailable, poison, unresolved
ending or admission unavailable. 10004 COMMON_INTERNAL: unclassified failure.
Use fixed safe messages and empty data; never expose SQL, account identifiers,
foreign ownership, source mapping or credential details. Get foreign IDs remains
indistinguishable from no scoped record. Authorization precedes state disclosure.
Any nonzero code, disconnect, timeout or malformed reply rejects only this packet
or leaves knowledge UNKNOWN; it cannot create/clear a durable rejected state.

Durable rejection is code=0 + rejected_no_effect from the retained ledger ONLY.
Reason TERRAIN covers the exact authenticated WORLD nonbuildability branch;
COORDINATE_OCCUPIED covers its exact coordinate uniqueness branch. A numeric
reason is not private failure provenance. No API error/sentinel can manufacture
it; the separate confirmed-whole-rollback/private-finalizer contract is mandatory.
The saved reason describes that ended attempt, not current tile availability.
Commit/rollback uncertainty preserves identity and source poison/drain duties.
A receipt explains one command only, never all server transactions or source drain.

## 7. Cross-language acceptance and activation gates

Go int64 and TS canonical decimal strings/bigints preserve every identity through
encode/decode, comparison, storage and response correlation. No intermediate JS
Number for account/player/city IDs, even below MAX_SAFE. Decimal input grammar is
[1-9][0-9]* with the signed64 upper bound, no signs/exponent/leading zeros.
Use presence-aware decoding and strict raw validation, not defaults:true to infer
facts. Current shared decoder handles only entry account_id losslessly; the new
codec must not route other IDs through number-based UI. With no lossless backend,
fail closed. Existing current-city navigation's numeric limit is a separate gate.

Golden input: realm 11111111-1111-4111-8111-111111111111, shard 1,
player 9007199254740993, account 9223372036854775807,
command 22222222-2222-4222-8222-222222222222, name 城, x=0, y=499, EMPTY.
C1 is 90 bytes; SHA-256 (check only, not equality):
6c7a376e196f51fb6a36497597e0f8af759aabb03a3f84a5938e40210e9bb23f.
Changing only predecessor to 33333333-3333-4333-8333-333333333333 yields
106 bytes and SHA-256 eeb911e086843f3329083b5d473b40d5d2ea62ae97017afacf40850aec35117a.
Both languages must produce complete identical bytes, then independently decode
actual protobuf messages. Freeze literal wire fixtures, not self-generated oracles.
Cover EMPTY/present-zero versus absence; 32/33 scalars; emoji/combining marks/NUL;
invalid UTF-8/surrogates; same-ID changed content; equal/conflicting duplicates;
unknown/nested fields; overflow/overlong varints; uint32/int32/int64 bounds;
1, 2^53-1, 2^53, 2^53+1, 2^63-1 identities; all states/outcomes; old/new codecs;
wrong-scope/stale-session and delayed different winner without automatic continue.

Contract tests/generated Go/CLIENT codecs/API handlers each require separate
registered cards and exact-head independent review/CI. No runtime bindings,
ledger SQL, DOM/APP/finalizer, source enrollment or production change is included.
Full PG17 ordinary/race, real ACK-loss/restart, native-browser and target-fencing
acceptance still precede activation. Legacy multi-city regressions remain required.
