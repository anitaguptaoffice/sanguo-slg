# CLIENT-REPAIR-004: real gateway int64 boundary

A real PostgreSQL/Redis/Go gateway browser run showed food/wood/stone/iron as zero
although the persisted wallet held 8000/8000/5000/5000. `getCityState` returned
protobufjs `Long` objects; `Number.isFinite` in the HUD correctly rejected these
objects, exposing a missing transport-to-UI conversion rather than a ledger loss.

`decodeGatewayResponse` now converts signed/unsigned 64-bit protobuf fields to
numbers only within JavaScript's exact safe-integer range, recursively including
messages, arrays and map values. Unsafe values throw with the field path instead
of silently rounding IDs or balances. Enum numbers, bytes and protobuf defaults
are retained. No protocol, server ledger, asset, or gameplay changes.

Validation: five real encoded-binary tests and strict `npm run build` pass.
Real Go gateway/PG browser before: food type `Long`, text `8006`, finite=false,
HUD0. After: type number, text8012, finite=true, HUD8,012; wood8,000/stone5,000/
iron5,000; real login/city/hero/world paths have zero page errors. Natural farm
production explains the food increment between observations; no balances seeded.
Local immutable before evidence: `browser-runtime/before-normalization/` under
workspace; after evidence copied to `browser-runtime/after-normalization/`.
These checks do not certify pending cross-service wallet repairs.
