# Retained Recruit rule evidence v1

Task: SPEC-RECRUIT-RULE-EVIDENCE-001 / [#1840](https://github.com/anitaguptaoffice/sanguo-slg/issues/1840).
Baseline main: `6031b73e5d489ce2d0ef8d957f81c9753d083d31`.
Inputs: [queue §3](MIL_RECRUIT_QUEUE.md), [command](MIL_RECRUIT_COMMAND.md),
[storage](MIL_RECRUIT_STORAGE.md), [transaction lifetime](MIL_RECRUIT_TX_LIFETIME.md).
This freezes encoding and the dormant registry boundary, not actual artifact
publication, numerical changes, runtime activation, identity provenance or deployment.
Existing units1–4, four resources/no gold and checked arithmetic remain unchanged.

## Canonical bytes and identifiers

A RecruitRule consists ONLY of unit_cfg_id, per-unit food/wood/iron/stone cost and
seconds_per_unit. Unit ID is1–4; costs are integers0..MaxInt64; seconds_per_unit is
an integer1..9223372036 so one unit fits a Go nanosecond duration. Count multiplication
remains checked for every plan. Any later timestamp addition is independently
checked by the schedule participant; Evidence.Plan has no clock and does not
validate scheduling. This adds no waiting-list/gameplay cap. Code/name/speed/combat stats are not recruit-rule fields.

RuleBytes is exactly the following concatenation, with no padding or separators:
1. ASCII `sanguo/recruit-rule/v1` followed by one NUL byte (`\x00`), 23 bytes total.
2. unit_cfg_id as unsigned32-bit big-endian.
3. food, wood, iron, stone, seconds_per_unit, each unsigned64-bit big-endian in
   that order. Nonnegative signed-int64 validation happens BEFORE encoding.

RuleBytes length is67. rule_digest is SHA-256(RuleBytes), exactly32 raw bytes.
A complete manifest contains exactly four validated rules, in unit-ID order1,2,3,4.
Reject missing, extra, duplicate or out-of-order rules; never fill from current defaults.
ManifestBytes is ASCII `sanguo/recruit-manifest/v1` plus one NUL (27 bytes), followed
by the four complete RuleBytes in that order. Length is295 bytes.
The manifest's exact version is ASCII `recruit-v1:` plus the64 lowercase hexadecimal
characters of SHA-256(ManifestBytes), total75 bytes. No whitespace, uppercase,
alternative prefix, Unicode normalization, trailing NUL or other representation.
Recompute from the full accepted rules and require exact version equality.

Persist catalog_version in receipt bytea as these75 ASCII bytes, without a trailing
NUL, and rule_digest as32 binary bytes. In the version1 queue JSON payload,
catalog_version is the exact75-character JSON string and rule_digest is the exact
64-character lowercase hex string WITHOUT a prefix. Decode/encode losslessly and
compare full rule/intent/cost/duration fields too; a digest is not a substitute for
semantic equality or authentication. No SQL shape change follows: existing nonempty
bytea checks remain physical constraints, stricter semantics belong to participants.

## Artifact ownership and retention

The release artifact's reviewable JSON envelope has exactly `format`, `version`,
`rules`. format is integer1; version is as above; rules is an ordered four-element
array. Each rule object has exactly `unit_cfg_id`, `cost_per_unit`,
`seconds_per_unit`; cost_per_unit has exactly `food`, `wood`, `iron`, `stone`.
JSON key order/insignificant whitespace are not canonical bytes. Strictly decode
original JSON before normalization: reject duplicate/missing/extra keys, strings as
numbers, fractions/exponents, range errors, nulls, wrong units and trailing input.
No JSONB round trip may erase evidence of duplicate keys before this validation.

Only separately reviewed server-controlled release artifacts may populate the
registry. A self-consistent content hash proves encoding integrity, NOT who approved
prices, artifact provenance, or authority to use it. Do not load definitions from a
request, job payload, receipt, mutable database template, arbitrary path or network
URL. The eventual release loader's fixed input/source binding and every production
constructor call site need independent review before activation. No new signature
key, credential, service or remote registry is introduced by this contract.

Keep every referenced manifest with its immutable version for all retained jobs,
origins and receipts, including terminal/unknown legacy states that need diagnosis.
Publishing a new current version is append-only with respect to retained history:
keep the old artifacts in the reviewed release/backup inventory. Never edit an old
artifact, delete it to force repricing, infer it from today's values or recreate it
from a job. Missing/untrusted retained evidence returns unavailable with no effects.
Backup/restore must restore this artifact inventory coherently with data and its
independent provenance/fence evidence. The registry alone cannot certify a restore.
Same version with conflicting canonical bytes is rejected, including any detected
hash collision; observed exact duplicate version records also fail construction.

## Go registry boundary for the subsequent MIL card

Implement only in `internal/military/march`, with no platform/API/DOM writes or live
Hub rewiring. Input value types are `RecruitRule` (UnitCfgID int32, Cost Resources,
SecondsPerUnit int64) and `RecruitManifest` (Version string, Rules [4]RecruitRule).
`RecruitManifestVersion([4]RecruitRule) (string, error)` validates and computes the
public integrity identifier; it does not make input trusted or publish an artifact.
`NewRecruitCatalog([]RecruitManifest, currentVersion string) (*RecruitCatalog,error)`
requires nonempty, validated, distinct versions and an explicitly present current
version; no first-record/default fallback. It copies all input values into private
immutable storage. No mutation, deletion, reload or current-version setter is exposed.
Replacing a configured snapshot is separately reviewed release work, not a request.

`Current(unitID int32) (RecruitRuleEvidence,error)` chooses only the captured current
manifest for NEW acceptance. `Resolve(version string, unitID int32, digest [32]byte)
(RecruitRuleEvidence,error)` finds the exact retained manifest and verifies its rule
digest; never falls back to current. Unknown version/unit or mismatch is unavailable.
A nil registry and zero evidence are invalid. Evidence fields are private; Version,
Digest and Rule accessors return value copies. Evidence.Plan(RecruitRequest) must
reject zero evidence and a mismatched unit, then use checked recruit arithmetic for
exact request count, four costs and duration. It is still only a calculation.

Future participants capture one trusted catalog snapshot at construction and resolve
through it themselves. They must not accept caller-supplied Evidence as authority.
Matching version/hash/evidence is NOT actor authorization, DB/source/role binding,
cohort admission, capacity, freshness or through-commit fence proof. All those gates
and the immutable receipt/job comparison remain mandatory. No automatic old-row
adoption, callbacks or SQL-to-Hub mirror are authorized.

## Golden vectors and acceptance

Illustrative vector rules (unit,food,wood,iron,stone,seconds):
`(1,40,20,0,0,30)`, `(2,80,40,20,0,45)`, `(3,50,60,0,0,35)`,
`(4,100,80,30,40,60)`.
These reproduce the current [Go defaults](../../internal/military/march/units.go),
not a new balance decision or approved runtime artifact. The generated
[cfg_unit SQL](../data/generated/cfg_unit.sql) has no recruit-cost/time fields;
do not claim it proves those values.
Rule1 digest: `4c1f706ca9b78d06bc4233a6bf52ac682b2998104754aca5f7f3fc5a68f64082`.
Manifest version: `recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f`.
Golden values must be independently reproduced from the specified bytes, not from
the implementation-under-test alone. No manifest file is published by this SPEC.

Test every field/range/order, exact golden bytes/digests, supplied-version tampering,
duplicate versions, missing current/history, digest/unit mismatch, snapshot input
mutation and returned-value mutation, nil/zero evidence, concurrent immutable reads,
old-version resolution after selecting a new current version, and arithmetic overflow.
A separately registered DATA artifact/strict loader card must verify the original
JSON rejection rules and retention inventory; typed Go tests cannot claim that.
Independent review, tests and exact-head/main CI precede implementation merge.
No durable debit/queue acceptance, actual restart, target-role rights, release-source
trust, numerical update, DATA-003, paid SKU or production activation is claimed here.
