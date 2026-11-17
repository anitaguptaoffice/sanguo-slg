# Durable first-city DOM template codec

Registered contract candidate; not adopted, implemented or enabled.
Task: [SPEC-FIRST-CITY-TEMPLATE-CODEC-001 / #2440](https://github.com/anitaguptaoffice/sanguo-slg/issues/2440).
Baseline: 0c412c89754f23d0dcb2275fe0c48c35ceb5f2c8, tree
ce7f77135b2972e2a403f80fa552633c330bbc16. No runtime or database changes here.
Depends on CITY_CREATION_RECOVERY, FRESH_CITY_PARTICIPANTS and FRESH_CITY_PROOF.
Wire's public TemplateRef is coordinated input, not an already adopted contract.

## 1. Purpose and selected format

Persist the complete server-owned initial DOM data when accepting PENDING.
The data must survive restart without looking up today's DefaultCatalog or
recreating today's handler defaults. A hash, pointer or version label is not data.
Select a closed fixed-width binary grammar, called FCT1 below. It is smaller than
a second proto schema and needs no protobuf unknown-field/default rules or JSON
number/key/escaping canonicalizer. This is a server storage format, not a client
input format. No JSON, gob, native-memory dump or protobuf deterministic Marshal
is interchangeable with FCT1. Do not persist a Go CityState struct representation.
The public wire exposes only TemplateRef, never accepts template bytes or hashes.

FCT1 captures all current CityState template degrees of freedom and every field
of every BuildingSpec, including catalog entries unused by initial buildings.
It preserves only data, not provenance, enrollment, actor identity, a FreshCity,
InitializedCity, source lease, transaction proof or execution authorization.

## 2. Template versus scope and runtime state

Variable template data: Wallet's Food, Wood, Stone, Iron; each Buildings slot,
CfgID and Level; all catalog ID/BaseTimeSec/BaseCost/ProdPerHour/ProdRes values;
and template, rules and catalog version labels. All fields below are mandatory.
Map insertion order, pointer identities and spare capacity have no meaning.

Realm, shard, account, player, operation/version, command ID, predecessor, name
and x/y belong to authenticated canonical command scope, never the template.
After fresh ACCOUNT/current-session and retained canonical binding checks, APP
passes that exact positive player ID to DOM restore. DOM must reject player <=0.
CityState.PlayerID is instantiated from that value, not decoded from bytes.
Changing actor must not change a template digest; it must change/check command
scope. A template cannot independently select or authorize an actor.

These CityState fields are fixed invariants, NOT variable encoded fields:
- ID=0. Only actual WORLD insert/readback and the consumed MIL proof supply ID.
- BuildJobs has length zero. Decode creates nil; nil and non-nil empty input
  slices encode identically. This is not permission to silently discard jobs.
- LastSettleAt is the Go zero instant. No Unix epoch, timezone or clock field.
- walletBase=Resources{}, walletSaved=false, nextJobID=0 and four zero
  productionRemainder values. No hidden cache or previous-wallet checkpoint.
Encoder rejects nonconforming input before producing bytes, using current
snapshotFreshTemplate semantics. Decoder reconstructs the fixed values exactly.
Buildings and catalog decode as fresh non-nil maps, even when empty.
Nonempty jobs, nil buildings, scheduled upgrade timestamps or existing-city
state are invalid, not a migration or normalization opportunity.

No time value is encoded. Actual DOM settled_at and MIL initialization use the
same trusted DB processing sample under participants rules, not intake time.
city_building.upgrade_finish_at is NULL; checkpoint remainders are initially 0.
The codec does not decide PostgreSQL timestamp precision or alter 007 semantics.

Resources has four fields, not gold. Preserve EVERY existing wallet value,
including gold; do not overwrite balances from this template. Where certified
retained history permits first wallet initialization, apply the four retained
resource values and gold=0, the existing 003 initial default. No gold grant,
refill, cap-clamping or wallet-repair mechanism is introduced by this codec.
WORLD is_capital=true, wall_level=1 and morale=100 remain separately frozen
first-city operation constants. They are not DOM fields and must be explicitly
retained in the execution contract/actual receipt, never read from new defaults.

## 3. Exact byte grammar

FCT1 has no optional fields, extension area, field tags, padding or compression.
All integer widths are exact; all multibyte integers are big-endian.
i32/i64 use signed two's-complement representation, with nonnegative/positive
semantic constraints below. u8/u16 are unsigned. Never cast an unchecked unsigned
number to signed or pass int64 through float64/JavaScript Number.

Concatenate these fields in exactly this order:
1. Eight magic bytes: 53 47 46 43 54 50 4c 00 (ASCII SGFCTPL then NUL).
2. u16 encoding version, exactly 1.
3. Three version strings, ordered template_version, rules_version,
   catalog_version: each u8 byte length followed by exactly that many bytes.
4. Four i64 initial resources, ordered Food, Wood, Stone, Iron.
5. u16 building count, followed by that many building records.
6. u16 catalog count, followed by that many catalog records.
7. Exact end of input. Any remaining byte is invalid.

A building record is u8 slot UTF-8 byte length, exact slot bytes, i32 CfgID,
i32 Level. Records are strictly increasing by unsigned lexicographic comparison
of the original UTF-8 bytes. Length is framing, not part of the sort key.
A catalog record is i32 ID, i64 BaseTimeSec, four i64 BaseCost resources in
Food/Wood/Stone/Iron order, i64 ProdPerHour, u8 ProdRes. Fixed record size: 53 bytes.
Catalog records are strictly increasing by positive numeric ID.
There is only one catalog ID field; decode reconstructs map key=spec.ID.
Encoder rejects an input map whose key does not equal spec.ID.

## 4. Complete bounds and validation

Encoded content length must be 52..262144 bytes, inclusive. Inspect length before
copying/allocating variable data. Checked readers must prove each next span lies
within remaining input, reject truncation, and never multiply unchecked counts.
The 52-byte lower bound is one-byte version labels with both maps empty.
Each count is 0..1024. These are new persistence resource limits, not existing
DOM gameplay limits; they do not authorize more than the reviewed server template.
Maximum structurally valid FCT1 length under these limits is 194801 bytes.
The outer 262144 cap leaves no extra legal extension bytes.

All three version labels match ASCII [A-Za-z0-9._-]{1,64}, case-sensitive.
No whitespace, NUL, normalization, aliases or empty labels.
Slot bytes must be valid shortest-form UTF-8, contain 1..32 Unicode scalar
values, at most 128 bytes, and no U+0000. Reject malformed UTF-8, surrogate values,
overlong encodings and truncation; do not repair with replacement characters.
Literal U+FFFD is valid. Do not trim, normalize NFC/NFD, case-fold or strip
whitespace. Canonically equivalent different byte strings remain different
slots. PostgreSQL varchar(32) character count and no-NUL requirements still apply.
Strict sorting rejects duplicate slot bytes or catalog IDs, even equal records.
JSON duplicate keys/unknown fields cannot occur because JSON is not accepted.
The analogous binary errors are duplicate entries, bad widths/counts, unknown
encoding versions, unsupported versions, trailing data or mismatched metadata.

Initial resources and each BaseCost field are 0..9223372036854775807.
CfgID, Level, catalog ID are 1..2147483647. Each building CfgID must exist in the
full decoded catalog. Nil building entries and nil input maps are invalid.
BaseTimeSec is 1..9223372036, exactly floor(MaxInt64/1000000000), not MaxInt64.
ProdPerHour is 0..9223372036854775807. ProdRes is 0..3, including when production
is zero; preserve a nonproducer's valid ProdRes rather than changing it to zero.
No smaller wallet/building/gameplay cap is added or inferred from the UI.
Validate every catalog entry, not only referenced buildings. Current snapshot
validation permits non-nil empty buildings/catalog, which FCT1 preserves.
No encoder/decoder validation mutates its input or returns partial usable output.

## 5. Reference, digest and decoder result

TemplateRef remains five fields: template_version, rules_version,
catalog_version, content_encoding_version and content_sha256. Version strings
exactly equal their embedded bytes, encoding version is uint32(1), and digest is
exactly SHA-256 over the COMPLETE FCT1 bytes, including magic/header/labels.
Digest is 32 raw bytes; human/test hex is 64 lowercase characters, not stored
as the FCT1 digest itself. No extra hash prefix, protobuf wrapper or implicit
JSON serialization participates in hashing. Empty content/hash are invalid.

Strict decode takes owned/copyable content bytes plus expected TemplateRef.
It copies the bytes; checks size/header/versions, every count/value/UTF-8 span,
sortedness, complete references and EOF; computes and compares the full digest;
compares all embedded metadata to expected Ref; reconstructs all typed values;
and re-encodes and requires byte-for-byte equality to the retained content.
Re-encoding checks canonicality, not trusted provenance or semantic support.
On any error it returns no usable snapshot. Never keep a partially decoded map.
The same rules apply before initial intake and on every retained-template load.

The typed result owns separate initial resource/building and catalog values;
caller mutations of input buffers, output buffers or maps cannot mutate another
result, the command's retained content, participant capture or Hub state.
RestoreTemplate's player input is validated before producing CityState; it is
not hashed or written back into content. Identity is rechecked by Prepare/Stage.
Full content comparison, not digest equality alone, proves template equality.
Two different contents with equal digest must never become interchangeable.

## 6. Version retention and release compatibility

Content/semantic changes require a new immutable template/rules/catalog label
as applicable; grammar changes require a new encoding version. Never redefine
an existing label to mean new bytes or defaults. The first release's selected
labels are dom-first-city-1, first-city-rules-1 and dom-default-1.
The corresponding full initial template is the inspected live handler's four
resources 8000/8000/5000/5000, farm=(2,1), hall=(1,1), and the complete seven-entry
DefaultCatalog recorded by golden vector current-default below. This describes
a candidate, not permission to activate it or a claim of original game balance.

A reviewed release has an immutable, independently retained template-definition
manifest mapping each supported (encoding, template, rules, catalog) tuple to
its exact COMPLETE canonical bytes and semantics. Startup captures that manifest
before serving commands. Initial selection is one explicit server-owned entry;
requests cannot select the entry, labels or bytes. Independently verify the
expected release/artifact identity; observed bytes/hash cannot self-approve it.
This is APP startup data alongside its source profile, not a new Profile flag,
configuration callback, per-request manifest injection or catalog replacement.
It is not an enrollment certificate and cannot replace external source provenance.

A decoder can parse data only for a grammar it implements. Execution additionally
requires the release's retained semantic support entry and full byte match;
knowing how to parse a record does not grant support for unknown rule semantics.
Unknown tuple, lost bytes/manifest/decoder, corruption or inconsistent metadata
makes that command unavailable. Never use latest defaults, rewrite labels,
repair old contents or convert this condition into REJECTED_NO_EFFECT.
Retain PENDING and all original bytes. A result reader must not fabricate EMPTY
or success; inability to validate the retained record is unavailable/quarantine.

All accepted template bytes and version decoders/semantic definitions remain
available for the full ledger retention period, including terminal history;
there is no TTL or garbage collection while any retained command refers to them.
Backups/restore must atomically cover canonical command, full template/ref,
slot/lineage/receipt and their required semantic definitions/provenance.
A release upgrade never edits a previous command's template. Old/new supported
definitions may coexist as immutable data, not switch the current Hub per request.

## 7. Captured catalog and the existing DOM interface

Keep FreshCityParticipant.Prepare(ctx, initial *CityState) unchanged. Catalog
remains copied from the exact Hub at participant construction under the adopted
participants contract. No request, decoder, import, setter or initializer
callback can replace it. Returned catalog data is not a catalog capability.

The same SPEC freezes the following narrow proposed DATA-ONLY surfaces in DOM;
these methods do not yet exist, begin no transaction and issue no business proof:
- FreshTemplateVersions has TemplateVersion, RulesVersion, CatalogVersion string.
- FreshTemplateContent has Versions FreshTemplateVersions, EncodingVersion uint32,
  SHA256 [32]byte and Bytes []byte. These are defensive DATA snapshots.
- ValidateFreshTemplateContent(content FreshTemplateContent) error.
- (*FreshCityParticipant).CaptureTemplate(initial *CityState,
  versions FreshTemplateVersions) (FreshTemplateContent, error).
- (*FreshCityParticipant).RestoreTemplate(content FreshTemplateContent,
  playerID int64) (*CityState, error).

ValidateFreshTemplateContent is a package-level pure validator applying all
section 5 decode/ref/SHA-256/re-encode checks on each retained-content load.
It accepts no Hub, participant or actor, acquires no locks and issues no SQL.
It returns only error, never CityState, catalog, proof or PreparedCity.
Success is not semantic/source/actor validity or permission to execute.
APP separately checks the retained manifest tuple and full bytes on every load.

CaptureTemplate validates/clones initial with the participant's captured catalog,
encodes the full pair and returns copied bytes/ref. It never accepts a catalog
argument. APP's immutable manifest must then match all returned bytes/ref before
intake. This check is not deferred until after PENDING has already been committed.
RestoreTemplate strictly decodes, reconstructs positive-player CityState, and
requires complete equality of the retained catalog against the participant's
constructor-captured catalog: same cardinality, IDs and EVERY BuildingSpec field.
It never mutates either map or looks up today's DefaultCatalog. APP separately
checks the immutable semantic manifest's full tuple/content before using it.
Both methods reject an invalid/uninitialized participant or missing capture.
They read only immutable captures; they do not acquire Hub gates/PG locks, wait
on mutable city state, publish caches, return a PreparedCity or establish a lease.
All reads/copies are bounded by section 4. Unsynchronized caller mutation is not
supported; retained content is copied before parsing and returned state isolated.

Authenticated result/discovery, exact duplicate readback and terminal replay
validate old content/manifest without RestoreTemplate or current-catalog equality.
PENDING may also be read with a different current catalog; readback never executes
it. Only actual PENDING effects require RestoreTemplate's catalog compatibility.

For execution, APP obtains a source lease and calls RestoreTemplate plus Prepare
before effect Begin/PG locks. Prepare obtains the cancellable gate, revalidates
the captured Hub/store/source/catalog wiring, validates and privately copies the
restored initial using the SAME captured catalog. Close/poison rules still apply.
APP retains/restores only server-ledger bytes tied to its locked command and
checks that exact command/template again inside the effect transaction. No
preflight read allows later SQL for a different command, actor or source.
No Hub/captured-catalog readback is attempted while holding DB row locks.

If an old PENDING's catalog differs from current capture in ANY field, fail
closed before effect Begin: PENDING/unavailable, no DOM/wallet/city/MIL effects.
Retaining the old bytes is necessary but does not make it executable by this Hub.
Recovery requires a newly reviewed compatible startup/release with matching
captured catalog and retained semantic support, after required external fences
and old-generation resolution; or a separate genuine multi-catalog compatibility
contract covering Hub operations, settlement, existing cities and writer rollout.
Simply feeding decoded catalog into Prepare, using a second ad hoc Hub or
relabeling the current catalog is forbidden. No online rebind/reopen shortcut.

## 8. Storage and actor lifecycle responsibilities

WORLD intake atomically stores canonical command and NOT NULL full template bytes
plus all five reference fields before accepting PENDING, under its slot/CAS rules.
Its DDL must bound bytea and labels/digest; SQL length checks alone do not validate
FCT1 or make storage recoverable. APP/DOM strict checks are mandatory inputs.
Exact replay/continuation uses the existing command's full content, never captures
another template, funds again, overwrites a balance or changes the command ID.
Original success/rejection keeps the same template/ref. No proof is deserialized.

DOM owns codec, isolated reconstruction, catalog comparison and final snapshot
validation; WORLD owns opaque bytes retention/immutability/atomicity, not DOM SQL.
WORLD storage types use bytes/primitive metadata, never import DOM; preserve
DOM -> MIL -> WORLD dependency direction. APP maps copied data at the boundary.
APP owns immutable release manifest selection/compatibility, canonical authority,
fixed invocation order, stage/read checks and ending classification. ACCOUNT
alone establishes actual actor validity. PLATFORM has no template authority.
Capture/Decode success is never an approval boolean or business success callback.

## 9. Golden vectors and required acceptance

The companion small fixture must freeze literal bytes and SHA-256, not merely an
encoder that generates its own expected values. At least two independently
implemented parsers validate exact expected hex/length/hash and typed equality.
Production tests must compare the actual DOM codec to these vectors; running a
scratch reference generator alone does not satisfy implementation acceptance.
Required positive vectors: minimal-empty, current-default, int64-max, Unicode
32-scalar/128-byte slot, reversed input insertion order, and nil/empty jobs equal.
Include BaseTimeSec=9223372036, Level/ID=MaxInt32, nonproducer ProdRes=3 and unused
catalog entries; roundtrip preserves these exact values and the entire catalog.

Required negatives: each truncated byte boundary, added trailing byte, bad magic/
encoding, unknown semantic tuple, empty/oversize/invalid version, swapped record
order, duplicate slot/ID, absent CfgID, bad UTF-8/surrogate/NUL/33-scalar/129-byte
slot, count=1025, nil maps/entries, all invalid CityState fixed fields, negative
resource/cost/rate, invalid ID/level/ProdRes and BaseTimeSec zero/9223372037.
Reject changed digest, changed embedded/ref labels and overlength before decode.
Exercise content mutations after capture/restore, unknown record without fallback,
separate actor instantiations sharing template digest without shared mutable state,
and every single captured-catalog field mismatch even if referenced buildings
remain unchanged. No Go error string authorizes a durable terminal rejection.

After R1/C1 upgrades to R2/C2, test original SUCCEEDED and REJECTED_NO_EFFECT
receipts and PENDING discovery/result/duplicate readback with retained R1 manifest:
all remain readable without current-catalog equality or execution preparation.
Explicit PENDING effect with C1/C2 mismatch remains unavailable with no business
writes. Unknown/corrupt/lost content or manifest remains unavailable, never EMPTY.
Pure validation alone must not authorize that effect or return executable state.

Later isolated PG17/process acceptance must preserve byte-identical old data over
intake ACK loss and crash-before-effect/restart, show duplicate intake never changes
template, and test new-release resources/catalog/rules changes fail or use precisely
the old compatible template. Confirm no wallet/gold/city/MIL/DOM writes on failures.
Test template loss/corruption/partial restore cannot fabricate EMPTY or replacement.
Combined review must cover the final DOM implementation, APP manifest/codec/gate
path and WORLD immutable storage. Unit/golden pass is not this PG proof.

## 10. Independent adoption and exact scope

This SPEC-only card scope is spec/rules/FRESH_CITY_TEMPLATE_CODEC.md
and spec/rules/fixtures/fresh_city_template_codec_v1.json only. No other files.
Budget: 336 rule lines plus 60 fixture lines, total 396 natural
additions+deletions. Do not minify obligations, omit fields or split an incomplete
codec to meet the cap. If final golden packaging grows past budget, re-scope the
card first; do not claim a partial codec or data-only hash satisfies recovery.
No implementation, generated bindings, migration, DB execution, activation,
backlog/wave, CI/permission, art, hold or legacy source changes in this card.

Review/adopt wire and this complete template contract before storage freezes
column/size/runtime-validation assumptions. Template may be reviewed in parallel
with wire because its complete private contents are a genuine storage input.
Notify WORLD/DOM/APP owners after adoption. Storage/participant freezes next,
then ending/phase capability contract, then separately registered implementations
and PG companions; complete combined acceptance and enrollment remain later gates.
Existing DOM metadata #2435/#2438 and PG companion #2436/#2439 are not the codec,
complete participant or full creation recovery. Do not borrow unmerged content.
No changes to #2426 denial, #2377 dependencies or #77/#82/#108 and other holds.
