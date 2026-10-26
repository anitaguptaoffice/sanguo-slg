# SPEC-MARCH-RETURNED-001 — authoritative returned-home phase

**Independent contract candidate; review/merge and freeze clearance required before
consumer implementation. Not deployed.** Baseline audit:
`867f686667c889cd679ea9b6bd5f07cfc9d4dc74` (2026-10-26).
Scope: this document, military proto, and contract-only wire fixtures/tests.
No runtime/generated Go/client/SQL changes; backlog is maintained by the orchestrator.

## Problem and decision

`BeginMarch` produces marching, but `MarkReturnComplete` resets a returned army to
pending. `ListMarches` retains the order as recent history; phase1 therefore looks
like genuine pending work forever. SnapshotMarch's survivor correction does not
repair this ambiguity. Add **`MARCH_PHASE_RETURNED = 5`** to the existing enum.
Do not reinterpret pending1 or delete completed rows to make the HUD look empty.

| Wire value | Meaning | Change |
|---|---|---|
| 0 UNSPECIFIED | Unknown/unavailable phase | None |
| 1 PENDING | Genuine pending departure | None; still valid and active |
| 2 MARCHING | Outbound movement | None |
| 3 ARRIVED | Existing arrived/stationed semantics | None |
| 4 RETURNING | Return movement not yet settled home | None |
| 5 RETURNED | Server completed home-return troop settlement | Additive terminal state |

This is **returned/home**, not a generic done/failure/cancellation enum. Zero-survivor
combat and no-battle arrival retain their existing phase3 behavior. No new purpose,
CancelMarch, RPC, march duration, combat outcome, food debit or gameplay is introduced.

## Authority and invariants

1. Only the successful server return-completion path may transition returning4 to
   returned5. Proposed domain name is `PhaseReturned = "returned"`. A clock passing
   `return_finish_at_ms` is not completion: the server must execute settlement.
2. Publish returned only after crediting the authoritative surviving troop stacks to
   the existing origin city. Reject invalid transitions before credit; a repeated
   completion/event must not credit troops or invoke the finished callback twice.
   Missing settlement prerequisites must not manufacture a returned-home result.
   This contract does not design a new retry or recovery subsystem.
3. Preserve the existing finished callback/hero-release flow and verify successful
   hero release in integration coverage. Phase5 describes army return, **not** an
   atomic/durable hero-idle guarantee: current `releaseMarchHeroByMarchID` clears its
   binding and ignores `ReleaseFromMarch` errors. That failure handling is separate.
4. Retain order/army identity, origin and route, purpose, departure/arrival timestamps,
   report linkage and authoritative survivor snapshot. Keep `return_finish_at_ms=0`
   outside phase4, including phase5. Do not add a completion timestamp or sentinel.
5. Keep all existing field numbers/types, enum values0–4 and route names. ListMarches
   remains **active + recent history**, not active-only. Preserve city/session/shard
   authorization, insertion ordering, limit default20/cap100, offset normalization,
   retention and total-before-pagination semantics. `total` is not an active count.
   No history pruning, schema migration or total/index consistency repair is bundled.
6. Never infer returned from phase1, old timestamps, zero return time, troops, hero
   appearance or an absent row. A genuine pending row stays pending, even with stale
   times. Unknown future values remain unknown, never coerced to pending or returned.

## Compatibility audit and rollout gate

The full tracked-tree audit found no assignment/reservation/alias of wire5. The two
proto definitions (`spec/proto/.../military.proto` and
`internal/api/proto/.../military.proto`) and generated
`internal/api/pb/sanguo/military/v1/military.pb.go` define0–4 only. Domain phases are
strings in `internal/military/march/types.go`; API uses an explicit switch in
`military_handlers.go`, so adding the contract alone cannot emit5.

`client/src/net/loadProto.ts` parses the canonical spec directly with protobufjs;
there is no separate generated client enum. `MarchSummary.phase` is numeric and
`decodeGatewayResponse` preserves numeric enums. Frozen old/new wire checks below
establish decoder compatibility, **not** semantic compatibility of old UIs.

| Consumer at baseline | Effect of receiving5 / required follow-up |
|---|---|
| `militaryFormat.ts` | Old long/chip labels say `阶段5`; add `已回城`, non-active styling, no countdown. Preserve1–4. |
| `worldMinimap.ts` → HUD, world-cell/stack/info-card counts | Explicit1–4 allowlist already excludes5. Assert terminal exclusion and pending inclusion throughout; do not count list length/total as active. |
| `militaryFormat.marchNeedsPoll`, MainCityScene, MarchListPanel | Explicit1/2/4 poll set excludes5; retain history/all filter and stop terminal-driven timers. Correct any history-as-进行中 wording. |
| `marchArrival.ts` / `marchArrivalPoll.ts` | Old2→3/4-only completion leaves tracked IDs polling on direct2→5 (or first snapshot5). Clear terminal IDs separately; do not generate a false destination-arrival/new battle reminder on4→5. |
| `cityChiefOffice.heroIdsOnActiveMarch` | Old exclusion of3 alone would treat5 as busy if optional hero fields exist; exclude5 without inventing authoritative hero status. |
| `militaryListFilter`, phase-change pulses, info cards, prefill | Keep returned history visible in all/default; no new filter required. It is not pending/returning. Audit selection, reread/relogin and repeat refresh; prefill is not troop availability. |
| Existing HUD test with synthetic5 | Already expects inactive, but is not evidence of a prior wire5 contract. |

Binary compatibility is additive on phase field9. Legacy protobufjs decode/toObject
preserves unknown numeric5, but its `verify` rejects5 because its enum is frozen.
Do not add that old validation step or promise compatibility for untested JSON enum
names/other clients. Old Go generated numeric-enum decoding must likewise preserve5;
test against the frozen baseline before regenerating the API binding.

**Do not activate server emission until API mapping/bindings and all supported client
consumers pass review/tests together.** Prefer updated client first, then coordinated
MIL/API activation. No capability field or legacy remapping is added. Old clients
may decode5 but display `阶段5` or retain tracked polling; rollout must not call that
fully supported. On rollback preserve truthful5/history, never remap returned to1.
Old retained phase1 rows are ambiguous; no clock-based backfill is authorized. A
deployment/restart that loses in-memory armies is not an acceptable migration proof.

### Database and future consumers

`spec/db/004_military.sql` uses **different vocabularies**:
`march_order.status` is1=in-progress,2=arrived,3=withdrawn; `field_army.status` is
1=stationed,2=marching,3=combat. Both are SMALLINT with no enum/check on status;
`idx_march_arrive` selects `status=1`. No other tracked military status constraint,
mapper or march-order persistence consumer was found. This absence does **not**
authorize storing wire5 there or reinterpreting SQL1 as pending.

No DDL/index change is needed for this memory-state/wire repair. Future persistence,
replay, scheduler hydration, JSON/export or other clients must explicitly map and
preserve returned without recrediting troops or scheduling it. A separate durability
contract must define SQL lifecycle, atomicity, recovery and allocator watermarks.
The native100→19 restart evidence already shows military state loss; phase5 does
not repair it and cannot make a database-only dump restart-ready.

## Minimal follow-on cards (draft scope, orchestrator owns registration)

- **MIL-MARCH-RETURNED-001**, `internal/military/**` only: add domain phase, change
  successful transition, guard return callback against replay/invalid settlement;
  update phase/snapshot/combat tests and domain documentation. Test genuine pending,
  early vs actual completion, survivor credit exactly once, repeat tick/event,
  invalid transitions and unchanged zero-survivor/no-battle outcomes. No persistence.
- **API-MARCH-RETURNED-001**, `internal/api/**` only, depends on reviewed contract +
  MIL: synchronize the copied proto, regenerate military.pb.go (never hand-edit),
  preserve generator provenance (baseline protoc3.21.12 / protoc-gen-go1.36.5), and
  map5 explicitly. Test real Go wire phase5 with survivors/zero return timestamp,
  retained list/history/total/pagination, valid phase1 and existing authorization.
  Keep SnapshotMarch's single locked copy. Test successful hero lifecycle; disclose
  existing release failure limitation rather than promise cross-domain atomicity.
- **CLIENT-MARCH-RETURNED-001**, `client/**` only, depends on reviewed contract:
  implement audited consumer behaviors above. Cover4→5, skipped2→5, first snapshot5,
  mixed genuine1+returned5, unknown future phase, repeated refresh and native relogin.
  Preserve timings, filters, history, selection, report navigation and no automatic
  gameplay. Split into domain-local ≤400-line cards if the full consumer set exceeds
  the limit; all are activation prerequisites, not optional polish.

## Verification and evidence boundaries

```sh
./spec/proto/validate.sh
PROTOBUFJS_PATH=/absolute/client/node_modules/protobufjs \
  node spec/proto/tests/march-returned-wire.cjs
```

The frozen fixture extracts unchanged MarchPhase/MarchSummary/ListMarches messages
from baseline proto blob `446d26b5f1a94bdafc07a6c3917c5d12562e46ef`; comments and
unrelated messages are omitted. Tests compare all13 summary fields and both list
fields, old values0–4, exact field9 bytes, old↔new decode and unknown future values.
Local contract check: all12 protos and the wire test passed; a separate read-only
probe against the unchanged baseline generated Go binding preserved/reencoded5/127.
The frozen fixture's descriptors matched the exact baseline messages/enum. These
results do not validate regenerated Go or the future MIL/API/CLIENT consumers.
Consumer acceptance still requires regenerated Go↔production H5 wire and full
applicable suites, then natural same-process return showing survivor-ready credit,
`已回城` retained history, no active badge/polling, and successful hero release.
Contract tests are not runtime/native acceptance; synthetic timers are unit tests,
never a substitute for an unmodified real-time lifecycle observation.

Earlier native runs establish the baseline bug only: backend
`2faa27f9eb437213f0e5bfc2dd7db4b705732bd2` returned166 of200 troops with phase1;
frozen `2f20ea871b81eb4a8b4bf61f310c92e73ca1c7ec` returned19 of100 with phase1,
then lost military state on restart. **Natural lifecycle acceptance for the new
phase5 is not yet available.** Future synthetic tests do not supply that acceptance;
existing runtime/gameplay timings must remain unchanged. No historical hold/reference merge, paid data/SKU,
PNG, external publication, live-state mutation or durability claim is included.
