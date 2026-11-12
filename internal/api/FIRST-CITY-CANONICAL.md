# Private first-city canonical intent

API-FIRST-CITY-CANONICAL-001 ([#2481](https://github.com/anitaguptaoffice/sanguo-slg/issues/2481))
implements the adopted [C1 contract](../../spec/proto/FIRST-CITY-WIRE.md),
accepted by SPEC #2442 / PR #2444 despite historical candidate wording there.

`newFirstCityCanonical` validates separately supplied derived and expected actor
values and a presence-aware domain request. It neither derives nor authenticates
scope. Callers must later obtain/revalidate it through trusted authority; a valid
value here grants no permission. Nil wrappers/fields are not EMPTY or zero.
The three private fixed errors distinguish unusable derived scope, malformed
input, and valid-but-different expectation. They are not public response codes.

The immutable string-backed result retains exact C1 bytes, including fixed
operation/version, every scope/proposal value and explicit zero coordinates.
`bytes` copies; `matches` compares every byte and rejects the zero value.
Caller input mutation after return is safe; concurrent caller mutation is not.
Tests freeze complete independent 90/106-byte vectors and cover validation,
lossless int64, Unicode, 231-byte maximum, presence, comparison and ownership.

No route, protobuf binding/decoder, source admission, DB, ledger, phase or runtime
activation is added. Legacy CreateCity remains unchanged. Full raw Go/TS codecs,
trusted realm/history authority, storage/finalization, transaction integration,
PG/restart/ACK-loss/browser acceptance remain separate activation dependencies.
