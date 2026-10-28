# SPEC-MARCH-PERSIST-001 — durable march identity and recovery

Status: **contract review prerequisite; not runtime activation.** This document and
`spec/db/m4_009_march_identity.sql` freeze the minimal persistence contract needed
to close the restart-loss gap (G3). No Go writer, production caller, data migration
or backfill is introduced here. Baseline `1f450937c7808829ec76bc2ce3f505b0e6a9cd5a`.
Design decisions are in the M0 design note `results/march-persistence-design.md`
(orchestration worktree); its earlier return-credit `exactly-once` discussion is
superseded by the known loss window and activation gate below.

## Lifecycle and transitions

`march_order.status` is the SQL lifecycle marker. It is not inferred from
timestamps and is never rewritten by this contract.

| Value | Meaning | First-slice writer | Allowed next |
|---|---|---|---|
| 1 | marching | create transaction | 3 or 4 |
| 2 | arrived (reserved for reinforce/unknown; not written by the first slice) | none | reviewed future use |
| 3 | returning | arrival or recall transaction | 4 |
| 4 | returned (terminal) | return transaction | none |

**Explicit contract change:** value 3 was previously documented as `撤回`
(withdrawn) and had no writer. It is now `returning`; this is a reviewed
reinterpretation, not a silent reuse. Value 4 is new. `MARCH-RETURNED.md` wire
phase 5 maps to status 4; wire phases are not derived from `arrive_at`.

Create writes one `field_army` row, one `march_order` row and its `army_troop`
stacks in one MIL transaction. A committed arrival writes `returning` and the
return deadline, or terminal `returned`; it never persists an unresolved
`arrived` state. Pending is unused: create begins at `marching`.

## Ownership

The only owner anchor is `march_order.army_id → field_army.owner_player_id`.
There is no `march_order.player_id` and no new FK. An army row must be retained at
least as long as its march order; on terminal return it stays at the origin with
`field_army.status=1` and its survivor `army_troop` stacks. Deleting the army row
would break `ListMarches`, restore authorization and hero release. Ownership is
immutable for the army lifetime; any transfer is a separate reviewed operation.

`origin_city_id` is nullable in this contract and required by every new writer.
A later `NOT NULL` is allowed only after an audit proves every retained row is
attributable; no implicit backfill or sentinel city is permitted.

## Hero link and release recovery

`field_army.hero_ids` is the durable march↔hero link; `player_hero` gains no march
column. The hero claim commits before the MIL insert, so a live persisted march
never exists without a claimed hero. If the MIL insert fails, release the hero;
release failures are retried or surfaced, never ignored. After terminal return,
release only after the terminal state is durable.

On restore, live marches keep their claimed hero; terminal orders release it. A
hero in status 3 with no live `field_army.hero_ids` reference is an explicit
orphan for the HERO M4 reconciler. Force refund is out of scope: a failed create
after claim may still spend the 10-point march-force cost; this must be stated,
not hidden by a fake refund.

## Allocator discipline

- `march_order_march_id_seq`, `field_army_army_id_seq` and
  `battle_report_report_id_seq` are permanent, schema-local, `bigint`, START/MIN 1,
  INCREMENT/CACHE 1, MAX `9007199254740991`, NO CYCLE, OWNED BY NONE. The ceiling
  preserves JavaScript safe-integer decoding.
- Writers allocate explicitly with schema-qualified `nextval` inside the same
  transaction as the owning insert. No column default, MAX+1, fallback counter,
  offset or ID rewrite. Gaps from rollback are harmless; reuse is not.
- No runtime `setval`, `ALTER SEQUENCE RESTART`, provision or repair. Before the
  first write, the writer audits the sequence against persisted IDs: when
  `is_called`, `max(persisted id) <= last_value`; when not called,
  `max(persisted id) < last_value`; and `last_value` stays within the ceiling. A
  lower/behind sequence fails closed and needs a separately reviewed maintenance
  action. A fully consumed sequence (`last_value=9007199254740991`,
  `is_called=true`) is accepted at replay as a valid non-resettable state;
  `NO CYCLE` fails the next allocation. Replay acceptance is not capacity.
- Restore preserves sequence identity; a missing ApplySpecs ledger row must replay
  the file without lowering or resetting a sequence.

## Atomicity boundaries

**Create.** Routed `StartMarch` first passes its zero-effect gate. Then: DOM
settlement → hero claim → MIL transaction (army + march + troops) → memory
publication and scheduling. The MIL transaction is the durable commit point for
the order. A crash after claim and before insert leaves a hero orphan for M4; a
crash after insert and before the response may duplicate the march on client
retry because `StartMarchRequest` has no command key. Retry idempotency is not
claimed.

**Arrival.** For a battle arrival, the `battle_report` row, `march_order`
status/deadline, `army_troop` survivors and `field_army` position/status commit in
one transaction: both the report and the transition commit or neither does. A
no-battle arrival writes no report row and transitions to returning with full
survivors; never finish an order with troops still only in memory. Report/arrival
errors are surfaced and retried or quarantined; they are never swallowed.

**Return.** The durable terminal `returned` status is the commit point. The first
slice credits the volatile process garrison, then writes terminal status; that
credit is not in the transaction. A crash around the credit/terminal write can
discard the credited troops; if terminal already committed, restore never replays
the order and they are never re-credited. If not committed, restore may attempt a
fresh credit but cannot recover the prior volatile one. This is a known loss
window, not a solved invariant: the slice guarantees only an at-most-once terminal
transition, never crash-safe or exactly-once stock.

**Activation gate.** The return/arrival path must stay disabled (`StartMarch` gate
and route cutover) until a separately reviewed durable stock-credit card makes
`city_troop` the authoritative garrison and commits stock and terminal status in
one caller-owned transaction. This contract does not define that card's stock
rows, barrier, FK, retention or receipt; restore ordering alone is not sufficient
evidence, and activation is blocked until the card lands.

## WORLD city barrier

March-only or hero-only writes do not themselves require the city barrier, and
the first slice takes no WORLD lock because it writes no `city_troop`. A
transaction that touches `city_troop` acquires `player_city FOR UPDATE` and keeps
that barrier held through every subsequent march/army-row write until transaction
end, including the terminal status write; there is no early release or commit
between stock credit and terminal. That transaction uses the frozen pin order
ACCOUNT → DOM wallet → WORLD city → MIL relations, with no Hub mutex held while PG
locks are held. It belongs to the separately reviewed durable stock-credit card
that gates activation; this contract does not define that card's schema.

## Retention, restore and unknown states

- Orders and their army/troop rows are retained as history after `returned`; no
  delete on return. `battle_report` retention is unchanged.
- Restore runs before the gateway accepts sessions and fails closed on an
  incomplete read. It re-schedules future deadlines and resolves overdue ones
  under the at-most-once terminal rule: a committed terminal transition is never
  repeated, but a volatile credit lost with a crashed process is not recoverable.
- A committed arrival is never replayed. An `arrived`/status 2 row, a report
  without its matching transition, an army without a march or a march without an
  army are quarantined for audit, not guessed.
- Multi-instance restore is unsafe until the APP generation lease exists; the
  first slice is single-restorer. This contract does not authorize a second
  restorer.

## No swallowed errors

`onMarchArrive` and the report/return callbacks must not convert a persistence
error into "no battle" or `emitMarchFinished`. An error leaves the march in an
explicit recoverable state; it must not silently drop survivors or claim a credit
not made. This does not close the volatile-credit crash window above.

## Non-goals

Home-garrison durability, `city_troop` backfill and durable return stock credit /
exactly-once settlement; activation before the separately reviewed stock-credit
card; `StartMarch` retry idempotency/command keys; quest delivery; client UX;
multi-instance semantics without the APP lease; reinforce/gather battle semantics;
cancellation; any `spec/proto` change; any Go implementation in this contract PR.

## Affected domains and cards

- MIL `internal/military/march`: M1 store, M2 restore, M5 arrival transaction.
- API `internal/api`: M3 restore wiring/readiness, M6 `StartMarch` gate.
- HERO `internal/hero`: M4 orphan-hero reconciler.
- Future APP activation card: composition, lease, route cutover, gate enablement;
  blocked until the durable stock-credit card above commits stock and terminal
  status in one caller-owned transaction.
- Dependency: this is M0; it unblocks M1–M6 but authorizes none of them. The MIL
  package remains serialized behind #1920, #1924 and #1925.

Replay/acceptance evidence: fresh PostgreSQL 17 ApplySpecs, ledger-missing replay
without sequence reset, populated-row immutability, wrong-owner/config/shadow
rejection, and `git diff --check`. No data migration, no `NOT NULL`, no
crash-safe stock-credit claim, no self-review.
