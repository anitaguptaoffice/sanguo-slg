# Dormant Recruit V2 codec

[CLIENT-RECRUIT-V2-CODEC-001 / #2352](https://github.com/anitaguptaoffice/sanguo-slg/issues/2352)
adds pure body encoding/decoding using the canonical types loaded by `getProtoRoot`.
There is no network method, route registration, journal, UI, fallback or server activation.
The legacy gateway decoder and RPC remain unchanged. This is not durable recruitment.

Request int64 city uses a canonical decimal string or bigint; int32 unit/count and uint32
version retain their full wire ranges, including unsupported versions for historical
comparison. Business admission remains server-owned. Command bytes are copied before encoding.
Acceptance int64 fields return exact decimal strings. The returned record and plain byte
arrays are frozen; no caller-owned or protobuf input buffer can mutate accepted values.
Malformed/missing responses throw and must be treated as unknown, never definite rejection.
Unknown protobuf fields retain normal forward-compatible skipping; known varints are checked
before protobufjs can narrow them. Standard proto3 scalar defaults are allowed.

Semantic checks follow [TRANSPORT](../../../spec/rules/MIL_RECRUIT_TRANSPORT.md) §2 and its
explicit preservation of [QUEUE](../../../spec/rules/MIL_RECRUIT_QUEUE.md) and
[STORAGE](../../../spec/rules/MIL_RECRUIT_STORAGE.md): queue IDs 1..9007199254740991,
positive city IDs, supported units 1..4, positive int32 counts, nonnegative full int64 costs,
status 0/1 and canonical catalog/digest byte shapes. [RULE EVIDENCE](../../../spec/rules/MIL_RECRUIT_RULE_EVIDENCE.md)
confirms the maximum duration 9223372036 seconds. UTC year0001..9999 timestamps use bigint
arithmetic: active start equals acceptance; waiting start may equal or follow acceptance;
finish equals start plus duration. City positivity is also required by the adopted
origin migration `010_create_mil_city_origin.psql`. Queue safe-ID bounds do not narrow city IDs.
These are shape/receipt invariants, not cryptographic verification, current catalog lookup,
proof of server commit, current wallet/stock, or validation against another pending job.

Tests use actual canonical protobuf bytes, full integer boundaries, invalid inputs,
proto3 zeros, UTC bounds, immutable byte ownership, and unchanged legacy safe-number behavior.
Run `npm test` and `npm run build` in client. Journal/crash/server/fence/rollout gates remain
separate requirements before any caller can expose V2; never fall back to legacy.
