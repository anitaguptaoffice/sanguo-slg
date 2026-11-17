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
