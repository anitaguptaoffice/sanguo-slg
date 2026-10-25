# GetCityState ready-garrison contract

Independent contract change; runtime adapters and generated code are NOT included.
Consumers: API/domestic adapter, military Hub, H5 client; related existing contracts
CONTRACT-001, CLIENT-059 / INTG-017. Subsequent repair cards are allocated separately.
No new RPC, DATA-003, battle protocol, database schema, SKU or IAP change.

## Wire and presence

Fields 1 (wallet), 2 (buildings), and the already deployed field 3 (production_rates)
retain their numbers/types. The canonical schema previously omitted deployed field 3;
this change repairs that drift. Field 4 is a proto3 message with ordinary message
presence, not an optional scalar or a new sentinel value.

- Absent garrison means no authoritative snapshot supplied; never interpret it as zero.
- Present `garrison {}` means the complete ready set is empty. Replace cached rows.
- Present nonempty garrison is a full replacement, not a delta: missing IDs mean zero.
- Rows have positive configured unit IDs and positive int32 counts, unique and sorted
  ascending by ID. Zero balances are omitted. Invalid source state fails validation;
  do not silently manufacture an authoritative result from invalid rows.
- Ready means completed, resident and available for debit in the current military Hub.
  Do not count pending recruit jobs, deployed/returning armies or wounded troops.
  Deadlines alone are not completion: the actual server transition must have run.

## Required adapter behavior after contract review/merge

1. Authenticate session/shard and authorize the city against selected-server ownership
   BEFORE balances, accrual, quest flushing, or military initialization. Foreign/missing
   cities use existing WORLD_CITY_NOT_FOUND. A matching global cache player ID alone
   is not shard ownership. Verify the Hub snapshot belongs to that authorized owner.
2. Use ONE locked, deep-copy `Hub.SnapshotCity(cityID)`, never a live map or per-unit
   reads straddling recruit completion/march debit. Serialize deterministic valid rows.
3. Do not reverse military -> domestic -> DB lock order. No domestic lock may be held
   while acquiring military lock. Wallet/buildings and garrison are separate snapshots;
   no cross-domain transaction is promised.
4. Unavailable Hub/snapshot: omit garrison. Do not EnsureCity(empty) just to satisfy a
   read. A valid existing empty snapshot emits a non-nil empty message. Reads must not
   recruit, force job completion, debit resources, or change military balances.
5. Client checks actual enclosing-message presence, including decoder default options.
   Present valid data replaces the city-specific ready map. Absent data may retain only
   explicitly stale same-session display; a fresh client shows unknown, not invented zero.
   Absence/deadline must not newly enable a march; StartMarch remains authoritative.
6. Refresh this existing RPC after observed military transitions. Key reads by
   session/server/city, discard obsolete responses, and serialize/invalidate reads around
   mutation responses. Never use Recruit(count=0), forced buttons or fixtures as queries.

## Validation and remaining gates

Run `./spec/proto/validate.sh` with protoc, and from repository root run:

```sh
node spec/proto/tests/garrison-wire.cjs
# If dependencies reside in another installed client checkout:
PROTOBUFJS_PATH=/absolute/path/client/node_modules/protobufjs node spec/proto/tests/garrison-wire.cjs
```

The wire test loads the actual pre-extension API extra.proto into a separate decoder;
it does not invent an old schema. It asserts its exact response fields and verifies
wallet/buildings/rates, unknown-field compatibility, and absent/present-empty bytes.
Run this baseline compatibility test before changing that active API adapter.

Before consumer acceptance, additionally test real Go encode / production H5 decode,
invalid rows, stable ordering, removed rows, nil snapshot, authorization before side
effects, and race-safe completion/read/debit. End-to-end acceptance requires natural
one-troop recruitment -> completion -> ordinary refresh ready=1 -> legitimate march
-> refresh ready=0; return must be observed independently, never inferred.

This contract is NOT military PostgreSQL, queue or crash durability. Current in-memory
Hub state can be lost while debit survives; existing city_troop DDL is not persistence.
A coherent recruit/debit/job/completion/march/return recovery design is separate work.
Contract review/merge and freeze-policy clearance precede all consumer implementation.
No historical reference or art-hold PR is included or authorized for merging here.
