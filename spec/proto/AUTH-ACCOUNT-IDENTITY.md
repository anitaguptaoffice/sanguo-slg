# Authenticated stable account identity

[SPEC-AUTH-ACCOUNT-IDENTITY-001 / #2356](https://github.com/anitaguptaoffice/sanguo-slg/issues/2356).
Baseline: 7079f87ed287d543a97ed220f3c67c4dcf2f72bb.
This independent SPEC adds only EnterGameServerResponse field 6, int64 account_id.
Fields 1–5, LoginResponse, RegisterResponse, routes and all other descriptors stay
unchanged. No new query RPC, generated binding, runtime behavior or activation.

## Producer contract

A successful identity-capable EnterGameServer response MUST carry the positive,
immutable account.account_id resolved from the same authenticated session that
authorizes this response's player and server. The account ID is global, not a
player ID or server ID; players on different servers may belong to one account.
Session renewal/rotation does not change account identity. IDs must not be
reassigned to another account while retained caller records can reference them.

The current [shard handler](../../internal/platform/shard/handlers.go) first checks
ValidSession, then SessionAccount and expiry, resolves PlayerOnServer with that
accountID and binds that accountID. A later producer card must populate field 6
from that same checked accountID, reject invalid identity rather than fabricate
one, and preserve response player/server/session binding. Do not add an unrelated
lookup, parse a token, or use request-supplied identity. Missing/error/expired
sessions and mismatched contexts cannot yield authenticated identity success.
This contract does not assert that the existing handler already emits the field.

The ID is a correlation value, never a credential or authorization capability.
Every operation still authenticates its session and validates actor/shard access.
Sequential session checks do not establish linearizable concurrent revocation;
no through-commit revocation, epoch fence or durable-command proof follows from
returning an ID. Existing authority and rollout gates remain mandatory.

## Consumer and legacy compatibility

Old protobuf readers ignore tag 6; their existing fields retain meaning.
New readers against old servers see absent/zero account_id. Treat both as
identity unavailable, preserving otherwise valid ordinary legacy entry behavior.
Do not fail all legacy login merely because the field is unavailable. No durable
journal scope or V2 identity may be created/resumed from that response.

An identity-capable client must decode the entire signed int64 losslessly,
validate 1..9223372036854775807, and retain a canonical decimal string or bigint
without an intermediate JS Number. Negative, out-of-range, malformed, rounded,
or conflicting values MUST NOT open a journal scope. Codec success alone is not
semantic validation. Never infer identity from a token, token hash, login name,
display name, RegisterResponse cache, player ID or an old account context.

Accept identity only from a successful authenticated entry response correlated
to the current entry attempt and session generation, with matching requested
server, response server and player server. Unsolicited, stale, failed or
context-conflicting responses cannot establish or overwrite identity.
Account/server/player switch, logout, reauthentication and generation changes
must suspend old in-flight UI publication and clear active identity before any
new scope is opened. Do not delete retained journal records: late results stay
associated with their original record, never the new session. Resuming requires
fresh authentication of the original full scope.

The [transport contract](../rules/MIL_RECRUIT_TRANSPORT.md) remains binding:
journal scope includes stable account, server, player and operation identity;
account_id alone neither enables V2 nor proves capability or replay safety.
Legacy continuation means only existing legacy behavior outside a certified V2
cohort. Never downgrade an unknown/pending V2 action, clear its records, or retry
it through legacy when identity/capability is absent, zero, invalid or changed.
Unknown capability remains disabled. Existing server-side legacy writer fences
for enabled cohorts cannot be bypassed by an old client or this fallback.

## Evidence and dependent ownership

Run the real protobufjs wire tests with the locked client dependency:

    NODE_PATH="$PWD/client/node_modules" node --test spec/proto/account_identity_contract.test.cjs
    bash spec/proto/validate.sh

The descriptor digest pins all baseline account/common descriptors, with only
the new field removed. Tests cover actual legacy/new codecs, golden wire tags,
missing/zero, full int64 extrema and truncated frames. Representable negative
values demonstrate the need for later semantic validation; these tests do not
pretend to implement consumer guards. protoc requires an installed compiler.

After independent review, required exact-head CI, applicable freeze clearance
and SPEC merge, notify ACCOUNT/PLATFORM/API/client owners:
- ACCOUNT: actual Go message binding and lossless marshal/unmarshal tests.
- PLATFORM: same authenticated account producer and invalid/expired/context
  rejection tests; no strengthened revocation guarantee without separate proof.
- API: wrapStarterEntry decode/re-encode preserves field 6 and all existing data.
- CLIENT: lossless identity decoder, old-server behavior, generation/stale-reply
  fences, retained journal isolation and no legacy retry on V2 uncertainty.
Each is a separate bounded card. Cross-component old/new server/client tests,
account switches, token renewal, large IDs and journal restart acceptance remain
unproven here. No deployment, default-off change or historical hold release.
