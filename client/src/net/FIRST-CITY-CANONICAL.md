# First-city C1 intent value

Registered [CLIENT-FIRST-CITY-CANONICAL-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2487).
New implementation of the adopted [wire contract](../../../spec/proto/FIRST-CITY-WIRE.md),
§§2–4 and 7, accepted through #2442/#2444 despite its historical candidate heading.
This is a pure business-intent component, not a protobuf mirror or playable flow.

## API and invariants

`createFirstCityIntent(expectedScope, proposed)` accepts untrusted values and
throws only `TypeError("Invalid first-city intent")` on invalid input.
Scope has `realmId`, numeric `shard`, and `playerId`/`accountId` supplied as
canonical positive signed64 decimal strings or bigint, never Number.
Proposal has `commandId`, `predecessor`, `name`, `x`, `y`. Predecessor is exactly
`{ kind: "empty" }` or `{ kind: "rejected", commandId }` with a different UUID.
Every field must be an own data property; extra fields and accessors are rejected.
All UUIDs are canonical lowercase v4. Names preserve exact scalar content,
whitespace, case, combining forms and literal U+FFFD; invalid surrogates fail
before UTF-8 encoding. Nothing is normalized, repaired, defaulted or generated.

The frozen result holds copied, nested frozen scope/proposal snapshots with
bigint identities. `encode()` returns a fresh C1 byte copy; `matches(unknown)`
accepts only identical full Uint8Array content, including exact length, not a hash.
C1 writes SGFC, versions 1/2, world.first_city, scope, command, explicit
predecessor, UTF-8 name and coordinates in the adopted fixed big-endian order.
Maximum size is 231 bytes. The complete 90/106-byte test literals were reconstructed
from field widths/order independently; their SHA256 values are additional checks.
Run `npm test -- src/net/firstCityCanonical.test.ts`, `npm test`, and `npm run build`
from `client`. No constructor, network operation or runtime import is exposed.

## Required later player-flow integration

1. Obtain fresh authenticated, losslessly decoded Discovery scope. Never invent
   a realm or reuse Number-backed legacy identity/response decoding.
2. On an explicit player proposal, generate a cryptographic command UUID; use
   this value to validate/freeze the complete intent and retain it before sending.
3. Feed a separately registered intent editor/per-scope store and distinct
   Submit/Continue operations through strict wire codecs. The server independently
   rebuilds C1 and validates authority; client C1 never selects authority.
4. Correlate replies with exact original scope/ID/content. Unknown, missed and
   old-scope replies never clear retained intent or automatically execute a winner.
   Continue and rejected successors require the appropriate new explicit action.
5. Enable gameplay only after independent ledger/template/physical authority,
   finalizer/DOM transaction acceptance and exact combined Go/TS raw-protobuf,
   PG ordinary/race, restart/ACK-loss, target-fencing and native-browser gates.

Those consumers and gates remain unimplemented here. No UUID generation, storage,
Gateway/UI integration, raw codec, DB/catalog, source enrollment, route/auth,
runtime activation or deployment is included. Go #2486 is comparison evidence,
not this module's dependency. This value proves neither RNG provenance, prior
persistence, current authentication, durable intake nor actual city creation.
