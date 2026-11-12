# First-city request payload codec

Registered [CLIENT-FIRST-CITY-REQUEST-CODEC-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2489).
Implements the adopted [wire contract](../../../spec/proto/FIRST-CITY-WIRE.md).
Depends on CLIENT C1 #2488, not presumed merged or adopted into main.

`encodeFirstCityRequest(route, value)` returns fresh Uint8Array payload bytes.
`decodeFirstCityRequest(route, bytes)` returns complete nested frozen snapshots
with bigint identities. Both throw only `TypeError("Invalid first-city request")`.
Exact routes are `world.v2.SubmitFirstCity`, `world.v2.ContinueFirstCity`,
`world.v2.GetFirstCityResult`, and `world.v2.DiscoverFirstCityIntent`.
Submit/Continue take `{ expectedScope, proposal }`, Get `{ expectedScope, commandId }`,
and Discovery exactly `{}` (zero bytes). Request wrappers are plain or null-prototype
own data objects; C1 validates scope/proposal without coercion or normalization.

Before protobufjs decoding, a closed recursive grammar checks actual presence,
singular/oneof uniqueness, field/wire types, minimal bounded varints, strict UTF-8,
lengths, depth <=8 and actual payload <=2048 bytes. U+FFFD/U+FEFF are preserved.
Missing Long or strict TextDecoder support fails closed. Literal fixtures are
independent tag/length/ASCII/UTF-8/base-128 derivations, not round-trip oracles.
Run both first-city test files, the full client suite, and `npm run build`.

This adds no sending, response/envelope parsing, authority, retained intent store,
Gateway/UI or activation. Those later consumers and all C1 activation gates remain
required; actual Go/TS raw-protobuf interoperation has not been executed here.
