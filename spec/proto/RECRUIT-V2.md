# Recruit V2 wire contract

[SPEC-RECRUIT-WIRE-001 / #2338](https://github.com/anitaguptaoffice/sanguo-slg/issues/2338)
materializes the adopted [transport contract](../rules/MIL_RECRUIT_TRANSPORT.md)
([#1901](https://github.com/anitaguptaoffice/sanguo-slg/pull/1901)).
Baseline: `cbdd409b66f48942071f8b793494d5f4af14d6a9`. No generated code, routing,
activation, gameplay, journal or deployment changes. All legacy descriptors remain intact.

## Boundary

`military.v1.RecruitTroopV2` uses its own request/response messages. Success requires
one validated immutable `RecruitAcceptance`, never current wallet/troop state.
Code 50008 is now allocated to accepted same-key/different-typed-intent conflict.
Other error mappings and authenticated readback ordering remain TRANSPORT §3.
Do not reject unsupported uint32 versions before historical comparison or narrow
them to smallint; only certified absence and exact version 1 permit new acceptance.
Malformed/absent response, timeout or internal failure is unknown, not rollback.
Proto3 can represent empty IDs, absent acceptance and invalid semantic values:
protobuf decoding alone is NOT validation. Status zero is valid waiting status.
Exact int64/bytes and all admission/receipt invariants require consumer validation.

## Verification

With the existing locked client dependencies available, from the repository root:

    NODE_PATH="$PWD/client/node_modules" node --test spec/proto/recruit_v2_contract.test.cjs
    ./spec/proto/validate.sh

The first command checks descriptors, fixed wire fixtures, signed int64 and full
uint32 codec boundaries, message presence, truncated frames and legacy bytes.
Its legacy descriptor SHA-256 was independently derived from baseline proto files
(military, envelope and imported common types), using protobufjs with keepCase.
This is wire verification, not server/caller validation or crash/database acceptance.
The second requires an existing protoc; absence is unexecuted, not PASS.

## Separate dependent delivery and notification gates

After independently reviewed SPEC merge, notify ACCOUNT, DOM, WORLD, MIL,
API/gateway and browser owners in the linked issue/PR before dependent work:
1. Generated backend message/error binding and exact uint32/int64 bridge tests.
2. Dormant authenticated V2 handler with reviewed immutable-result/error mappings,
   historical-before-current-ownership readback and no unsafe quest follow-up.
3. Browser exact decoder plus transactional durable caller journal and scoped retry.
4. Cross-component real restart/crash, unknown-result and current-state refresh tests.

V2 remains disabled until TRANSPORT §5 and its semantic/storage/epoch/catalog/
writer-fence gates pass together. Unknown capability means disabled; never fall
back to legacy. Legacy behavior outside a certified cohort is not retry-safe.
Do not enable mixed writers or roll back an accepted V2 cohort to legacy without
separately reviewed drain/reconciliation/fences. QA and historical holds stay held.

## Local prepared WebSocket negotiation

[SPEC-RECRUIT-LOCAL-WS-001 / #3111](https://github.com/anitaguptaoffice/sanguo-slg/issues/3111)
defines capability confirmation for the explicitly enabled local prepared runtime.
Both ends use the existing binary gateway envelope on `/ws`. The offered and
selected WebSocket subprotocol token is exactly `sanguo.recruit-v2`.

- The Go runtime selects the token only when the client offered it and prepared
  Recruit startup succeeded on the reviewed loopback source with the V2 route
  installed and incompatible writers fenced. A runtime outside that mode leaves
  the token unselected. A connection without an offer retains its existing
  envelope, routing and authentication behavior.
- The opted-in local browser offers the token on its configured loopback gateway
  connection. Require the actual open socket's `protocol` to match before any V2
  command or replay. Browsers fail an offered handshake without acknowledgement
  under the [WHATWG connection algorithm](https://websockets.spec.whatwg.org/#opening-handshake).
  Expose connection failure and keep recruiting disabled on that path. Do not
  reconnect without the token to resume recruitment or send a V1 request. The
  ordinary browser mode uses the original handshake and legacy behavior.
- The selection confirms transport support on that socket. Each request still
  needs the current authenticated account, shard and player, and the current
  source may reject an operation or become unavailable. Socket replacement,
  disconnect and authenticated session changes invalidate prior authorization.
  The persisted intent stays with its original scope. An unknown result can
  only be replayed with the same key and intent after confirming the new socket
  and authenticating the original actor.
- This is an owned local pairing. Keep the same browser origin and gateway
  source across restarts, and use a distinct browser origin for another source.
  Account, shard and player identifiers in the journal are scoped to that owned
  source. The token carries neither player data nor source credentials.

The handshake follows [RFC 6455 §4.2.2](https://www.rfc-editor.org/rfc/rfc6455.html#section-4.2.2).
Consumer acceptance includes a real browser receiving the selected token in
prepared mode and failing closed on a legacy server, usable ordinary legacy
connections, authenticated same-command replay after socket replacement, and
confirmation that a failed capability check sends no recruit request. No
protobuf message or route changes are needed.
