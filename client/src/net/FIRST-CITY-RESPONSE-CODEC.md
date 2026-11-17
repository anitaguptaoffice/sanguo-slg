# First-city response payloads

CLIENT-FIRST-CITY-RESPONSE-CODEC-001 (#2493) implements all four adopted V2 response payloads.
`decodeFirstCityResponse(route, bytes)` parses the closed raw grammar with explicit presence,
strict UTF-8, minimal bounded integers, complete oneofs and durable-state consistency.
Returned predecessor links also reject provable lineage contradictions without inferring absent history.
It returns frozen domain values with bigint identities, retained C1 intents and immutable
lowercase hexadecimal SHA-256 strings. Invalid input throws a fixed safe TypeError.
Payload validity is not authority, packet success, session/trace correlation or city entry.
The next complete packet/Gateway boundary must validate binary framing and strict envelopes,
then correlate current session, request scope/ID/full C1 before consuming these values.
Any invalid/nonzero/timeout result remains UNKNOWN and cannot replace retained knowledge.
Only later explicit submit/Continue UI may act; no auto-create, winner execution or legacy fallback.
Gateway, storage, UI, request codec, server handlers and activation remain unchanged.
Run focused firstCity suites, full `npm test` and `npm run build` from client/.
