# Dormant Recruit browser journal profile

[SPEC-RECRUIT-CLIENT-JOURNAL-001 / #2376](https://github.com/anitaguptaoffice/sanguo-slg/issues/2376).
Proposed until independently reviewed and adopted. Baseline main `78f0562d`.
This selects client persistence details under [TRANSPORT](MIL_RECRUIT_TRANSPORT.md)
§4, [authenticated identity](../proto/AUTH-ACCOUNT-IDENTITY.md), and the adopted
[V2 wire](../proto/RECRUIT-V2.md). It neither changes those contracts nor enables
a route, creates a server rejection ledger, or certifies a browser implementation.
The stale legacy-cutover wording in [#1950](https://github.com/anitaguptaoffice/sanguo-slg/issues/1950)
is superseded by its contract-correction comments; cutover remains blocked.

## 1. Identity and supported storage boundary

Only a fresh live authenticated-entry accessor may open the current scope. Its
account, server and player are separate values, never inferred from tokens,
names, cookies, cached entry responses or another account's retained records.
Persist all three as canonical positive base-10 strings without leading zero,
sign, whitespace, exponent or intermediate lossy Number conversion. Initial
client profile: account `1..9223372036854775807`, server `1..2147483647`, player
`1..9007199254740991`. The latter two reflect the existing checked numeric client
boundary, not a new server limit or a claim of full-int64 player support.
Convert them only after Number.isSafeInteger and range checks; reject -0.

Scope S is the four-string array `[account, server, player, "RecruitTroop"]`.
The operation remains the adopted logical operation, not a new V2 namespace.
Session generation is an in-memory publication/attempt fence, NOT part of S.
Recheck the live accessor and its generation after asynchronous preparation and
immediately before sending. A mismatch suspends sending/UI, retains the record,
and requires fresh authentication of the identical S before explicit recovery.
Logout closes local handles without clearing any journal store.

The initial storage adapter is IndexedDB on a secure, first-party origin, in a
normal disk-backed browser profile. Known private, ephemeral, restored, denied
or unsupported profiles fail closed. Do not sniff private mode or claim it is
universally detectable. Require WebCrypto getRandomValues and SHA-256, IndexedDB
transactions reporting `durability === "strict"` for every data write, and Web
Locks for the later cross-tab network coordinator. No local/sessionStorage,
memory adapter, service-worker cache, relaxed/default fallback or mock qualifies.

Browser/OS/profile combinations must be separately enrolled by a reviewed test
record naming exact browser build, OS, profile directory/storage configuration,
adapter commit/tree, and crash tests in §7. No combination is enrolled here.
An allowlist entry must identify that evidence, not an arbitrary caller-supplied
`durable: true`. Unknown combinations remain unavailable for mutation; code may
still be developed/tested while activation is held. Production enrollment and
server capability/cohort authorization remain separate reviewed gates.

The [IndexedDB standard](https://w3c.github.io/IndexedDB/#transaction-durability-hint)
defines strict as a durability hint. A successful request is not transaction
completion. Wait for complete, then validate a fresh transaction's readback.
Neither these checks nor browser process-restart tests prove immunity to power
loss, faulty hardware, profile deletion, all browser bugs or coherent rollback.
The [Storage standard](https://storage.spec.whatwg.org/#dom-storagemanager-persisted)
reports bucket persistence, not a per-transaction disk attestation. Query its
state for the enrolled profile; do not fabricate a grant or automatically call
persist() to obtain permission. The initial profile does not require a grant:
eviction remains an explicit excluded loss mode even when a grant exists.
Known eviction/deletion/restoration blocks affected unresolved actions. Missing
records never establish server rejection; cross-device/lost-history recovery is
not provided. No global proof of all historical records is required for first use.

## 2. Canonical immutable record

Database `sanguo-recruit-journal`, version 1, contains exactly two object stores
without auto-increment: `commands` and `slots`. Both use explicit out-of-line
keys. A command key is `[...S, commandHex]`; slot key is S. Store names, key/value
agreement and schema version are validated before use. Unknown versions block;
never delete/recreate the database or silently treat an upgrade failure as empty.

Each command value contains exactly `payload`, `payloadDigest`, `phase`,
`attempt`, `uncertain`, `outcome`, `recordDigest`. Payload is this ordered array
of ten strings, with no extra members or alternate encodings:

    ["recruit-journal-v1", account, server, player, "RecruitTroop", commandHex,
     intentVersion, city, unit, count]

commandHex is 32 lowercase hexadecimal characters encoding exactly 16 bytes,
not all zero (individual zero bytes are valid).
New intentVersion is exactly `"1"`. Retained unknown versions are quarantined,
not rewritten to 1. City accepts canonical signed int64, unit/count canonical
signed int32, matching the existing encoder; server admission still decides
whether an exact intent is valid. No truncation, clamping or price inference.

payloadDigest is lowercase hex SHA-256 of UTF-8 JSON.stringify(payload), with no
BOM, whitespace or trailing newline. Fixed string positions avoid object-key
order, numeric formatting and delimiter ambiguity. Validate all fields first.
This digest binds the whole local scope, key and typed intent, not protobuf bytes,
trace, credentials, current price or mutable transport state. Reuse the adopted
codec to construct each wire request from those exact retained values.

Golden payload (one uninterrupted JSON line):

    ["recruit-journal-v1","9223372036854775807","2147483647","9007199254740991","RecruitTroop","000102030405060708090a0b0c0d0e0f","1","9223372036854775807","4","2147483647"]

Expected payloadDigest:

    d8fe11e820bda766f805f497a59c1134976bd23046b54487beb5010d1f7bd4bf

Phase is `prepared`, `attempting`, `unknown`, `accepted`, `rejected` or
`quarantined`. A new record is prepared / attempt 0 / uncertain false / outcome
null. Attempt is a nonnegative safe integer, incremented with checked arithmetic.
Uncertain is boolean and sticky once true; unknown requires true. Prepared has
attempt 0; attempting/accepted/rejected require a positive attempt. Outcome is
null for prepared/attempting/unknown. Accepted outcome is the ordered 15-field array from the
wire contract: all scalar fields canonical decimal strings, catalog_version
150 lowercase hex characters and rule_digest 64 lowercase hex characters.
Rejected outcome is one canonical decimal error-code string from §5.
Quarantined outcome is `[reason, priorRecord, observationHex]`: reason is one of
`intent-conflict`, `receipt-conflict`, `terminal-conflict`, `known-restored`;
priorRecord is the exact JSON.stringify of the former valid record's ordered
`[payload, payloadDigest, phase, String(attempt), uncertain, outcome, recordDigest]`;
observationHex is the conflicting raw response's lowercase hex, or empty for
known-restored without a response. Retain attempt, set uncertain true, preserve
payload/digest, and never overwrite an already-quarantined record. No recursive
quarantine of prior quarantine is allowed. Invalid raw records are not rewritten.
recordDigest is lowercase SHA-256 of UTF-8 JSON.stringify of
`["recruit-record-v1", payloadDigest, phase, String(attempt), uncertain, outcome]`.
It must be recomputed whenever mutable metadata changes, never instead of
checking payloadDigest and full payload/key/schema/state invariants.

A slot value is exactly commandHex. Every command in prepared/attempting/unknown
phase must be the sole such command for S and be its slot target. Any quarantined
record blocks all of S even if its slot has since advanced to another command.
The slot remains pointed at the latest terminal command, rather than disappearing
on resolution. All retained commands remain independently addressable by key.
These public checksums detect accidental inconsistency only. They are neither
secrets, authentication, trusted timestamps, nor proof of server acceptance or
protection against coherent malicious rewrites, restored snapshots or deletion.

## 3. Atomic action creation, not intent deduplication

The UI first observes the current slot (possibly absent). A distinct deliberate
new action carries that observed predecessor commandHex, or null for a genuinely
empty slot. A retry/recovery carries the existing exact command key instead.
Same tuple does NOT mean same user action. Never automatically reinterpret a
failed compare-and-swap as permission to start another action.

Creation validates the live scope and exact intent, generates command bytes with
crypto.getRandomValues, rejects all-zero and computes digests before opening the
write transaction. One strict readwrite transaction over BOTH stores validates
the current slot and retained state, compares the expected predecessor, and uses
add() for the new immutable command plus put() for its slot. Creation is allowed
only for an absent initial slot or a matching terminal accepted/rejected slot.
Unresolved/quarantined state blocks distinct new actions for S in this initial
conservative client profile; this is not a server queue/capacity restriction.

Different concurrent tabs/clicks observing the same predecessor cannot create
two commands: only the winner advances the slot. The loser returns the observed
active record/pending conflict, never silently re-labels its input as a retry or
creates a fresh key. UI repeated clicks retain their action handle; it must show
an existing action and require an explicit new-action gesture after resolution.
Different intent while unresolved is blocked, not merged into the active tuple.

An exact-key local collision aborts the whole transaction and may regenerate
only before any send, while repeating the predecessor check. Randomness failure,
bounded generation exhaustion or any other storage error returns unavailable.
Do not continue a transaction after ConstraintError or accidentally swallow its
abort. Never overwrite an existing command. Payload and payloadDigest are
immutable for the entire retained lifetime, including definite rejection.

Wait for transaction complete, then read both stores in one fresh snapshot,
validate their correspondence, the complete record and its digests. Only then
return an immutable copied handle. Any abort, quota/access error, incomplete
readback, serialization failure or scope/generation change prevents a send.
Readback failure leaves any possibly committed record retained, not removed.
Do asynchronous hashing outside live write transactions; if validating an older
snapshot asynchronously, compare its exact contents again inside the subsequent
write transaction before changing anything. Never rely on an expired transaction.

## 4. Recovery and quarantine

Opening a scope scans its retained commands and slot in a consistent snapshot,
validates every relevant record and checks the unresolved/slot invariant. An
unclassifiable key/schema record blocks the database because its affected scope
cannot safely be identified; identifiable corruption blocks that S. Preserve
original evidence unchanged. Do not repair digests, drop unknown properties,
truncate malformed bytes, drop orphan records, rebuild a missing slot, or infer
absence from one missing half. No automatic migration/cleanup is defined in v1.

Quarantine is a logical refusal first: it must survive reopening by validation
of unchanged bad evidence. A valid record may be marked quarantined only by a
strict atomic write preserving its complete prior record and observation as
specified in §2. Never overwrite malformed evidence just to set a flag.
Failure to persist a quarantine marker never grants permission to proceed. Known
restore/uncertainty is an external block as well; a local flag cannot certify its
own absence after rollback. There is no clear-quarantine/reopen API in this card.
Any repair or migration needs a separate reviewed evidence-preserving protocol.

Prepared records found on reload are recoverable by exact identity, but never
proof that no send occurred. Conservatively treat a recovered prepared record
as unknown before any retry; only its live original creation handle may start
an attempt with uncertain=false. Attempting without its live owner is unknown.
All recovery is local inspection only until a deliberate same-key retry and all
authenticated server/cohort/profile gates permit the later network coordinator.
No reconnect, timer, reload, logout/login, readback or focus event auto-sends.
No V2 attempt is ever replaced by legacy or by a new key to resolve uncertainty.

## 5. Later network coordinator and outcome boundary

The storage component itself has no network dependency or send callback. Future
integration must use the same-origin Web Lock named JSON.stringify(["recruit-send-v1",
...S]) for the entire attempt, from pre-send state checks through outcome handling.
It must not force-steal a lock, use time-based ownership leases, or send outside
the lock. Browser lock release after termination does not prove server rollback.

Inside that lock, revalidate the live authenticated identity, record, slot and
activation gates. Strictly persist attempting with attempt+1 before every send,
then validate readback. If a previous attempt was not conclusively resolved,
set uncertain=true and keep it true. No send is permitted before that commit.
Timeout, disconnect, abort after possible send, missing/malformed response,
10003, internal error, uncertain commit or interrupted result persistence yields
unknown. Unavailable authentication/capability never authorizes legacy retry.

Correlate the actual response to its original persisted attempt, even after a
scope switch. Validate success with the adopted decoder, match city/unit/count
to the immutable intent and require supported intent version. Atomically persist
accepted outcome and its digest, complete and read back before displaying resolved.
A late validated acceptance may resolve only its original record; it cannot
publish into a newer session or overwrite a different accepted outcome. A second
different acceptance, accepted-after-rejected contradiction or explicit 50008
conflict is quarantined, not repaired by generating a new key.

A rejection resolves only the current live, uniquely owned attempt with no
earlier uncertain attempt and a certified-absence rejection under TRANSPORT §3.
Allow only 50001, 50002, 50003, 50004, 30001. Other errors remain unknown or blocked;
10001 is not a convenient repair path for a valid version-1 immutable record.
An error response cannot prove an older timed-out attempt never committed: if
uncertain=true, keep unknown, even after a business rejection. Same-key explicit
readback may resolve to validated acceptance; authoritative unknown/poison
recovery remains governed by the server contracts, never a new local reset API.
Confirmed rejection is retained and never retried as a new mutation with that
key. A later deliberate new action uses the predecessor compare-and-swap in §3.

All terminal writes compare the original exact command and current metadata in
one strict transaction. Persistence failure leaves unresolved evidence and UI;
do not report local completion from a transient reply. Wallet, ready troops and
live queue are separately refreshed current-state reads. Historical acceptance
and initial estimates never overwrite current state or prove a later rejection.

## 6. Retention and implementation ownership

No record expires automatically; server command keys do not expire. Keep resolved
bindings while retries are supported and all unresolved evidence indefinitely.
Logout, account switch, memory reset and session renewal never delete records.
No import/export, backup restore, cross-origin/profile/device reconciliation,
storage permission request or destructive migration is part of this profile.
The account ID is ordinary correlation data but remains local to the game origin;
do not log/upload journal contents or include any credential in keys/values.

First client component may implement complete local prepare/inspect semantics,
default-off and without networking, with its own real storage tests and docs.
Outcome integration and activation require their own complete reviewed cards.
Do not split a broken implementation merely to meet the 400-line limit; if one
coherent component plus negative tests/docs exceeds it, report the scope blocker.
Notify CLIENT, API/gateway and SPEC owners after adoption. ACCOUNT/DOM/WORLD/MIL
authority, wallet serialization, provenance, writer fences and held work remain
unchanged. Identity/codec availability alone is never an activation capability.

## 7. Required evidence before implementation acceptance and activation

Tests use actual IndexedDB/WebCrypto/Web Locks in a real persistent browser
profile on the enrolled configuration, plus isolated deterministic failure
controls. Record exact source/tree, browser/OS/version/profile facts and raw
per-case results. Mocks and jsdom prove logic only; no skip counts as pass.

- Canonical boundary/digest golden vector; independently alter every scope,
  key and tuple field; reject alternate encodings, overflow, all-zero ID and
  digest disagreement; collision regeneration cannot overwrite existing history.
- Request success followed by transaction abort, failed complete/readback,
  denied/unsupported/relaxed storage, quota/hash/randomness failures and stale
  generation must produce zero network submissions. Verify actual send counts.
- Two real tabs racing the same predecessor yield one command; stale tab cannot
  create after another terminal advance. Equal-intent distinct deliberate actions
  get distinct keys after resolution; changed intent while pending is blocked.
- Kill the owning browser process without graceful context close before commit,
  after complete/readback, before send, after send and before outcome persistence.
  Relaunch a fresh process with the same disk profile. Verify exact records/slots,
  command/digest stability, no automatic send and no new key for uncertainty.
- Logout/relogin/token rotation and account/server/player switches retain original
  records and fence stale UI. Same-account different-server/player never shares
  a slot; late accepted replies affect only their original record.
- Missing/partial/orphan/unknown-version/digest-corrupt/known-restored records
  block without deletion or reconstruction; failure to write quarantine cannot
  reopen. Complete profile loss is not advertised as detectably recoverable.
- Before activation, actual authenticated V2 server/PG evidence must prove
  same-key first/replay outcomes, lost commit acknowledgement, rejected response
  after earlier uncertainty, accepted persistence failure, conflicting receipt,
  no legacy fallback, writer fences and independent current-state refresh.

Browser termination tests establish only the tested process-crash profile.
Operating-system crash or power-loss guarantees require separate evidence and
are not claimed here. No documentation, digest vector, successful API property
read or fixture-only run substitutes for the above integration and release gates.
