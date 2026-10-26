# Shop persistence boundaries

## Daily purchase periods

A daily counter is keyed by the civil year/month/day supplied by the service's
clock (`Service.now`). List and purchase retain this same clock policy. This is
not a new UTC reset policy or a player-timezone lookup: production currently uses
`time.Now`; tests may inject a location. The clock's location must be consistent
for the intended natural-day boundary.

`daily_period` is a SQL `DATE`, not an instant. pgx decodes it at UTC midnight,
so compare its date fields to the clock's date fields, without converting either
to another zone. Existing stored dates need no migration. MemStore uses the same
civil-date comparison, including when the same date has different offsets or
location representations. A different civil date is a new daily period, even
when two timestamps represent the same instant. Only the current daily period
is stored; these counters are not a history/time-travel API.

`LimitResetsAtMs` remains the next midnight in the clock's location, computed with
calendar-day addition, not a fixed 24-hour duration. DST days can be 23 or 25
hours. Lifetime counts remain cumulative; unlimited offers return count zero.
No catalog, price, stock, limit value, or schema is changed by this policy repair.

The calendar tests cover UTC, positive/negative offsets, both DST transitions,
local midnight, location representations, lifetime/unlimited counts, new PG
pools, and serial cap rejection. Memory-only cases retain debit/grant assertions;
PG cases commit supplied-tx SHOP participants with nil payments and verify durable
counter/ledger rows, not a hybrid PG-counter/memory-payment purchase.
Run with a disposable database: `DATABASE_URL=... go test -race ./internal/shop`.

## Transaction scope

`Service.Purchase` now rejects nil services/stores, PostgreSQL, wrapped stores,
and all other custom stores with `ErrPurchaseTransactionRequired`, before the
clock, persistence, or payments are accessed. Only a concrete non-nil `MemStore`
is accepted for legacy non-atomic fixtures: spend, stock, grant and counter remain
separate operations there. Custom fixtures must use an explicit `NewMemStore()`
or supplied-tx participants; rejection never falls back to memory or retries.
Calendar/counter tests do **not** establish wallet/items/receipt atomicity.

This is the SHOP S4 activation guard, **indivisible from API A4 route activation**.
Integrate/deploy neither side alone. All incompatible old SHOP endpoint writers
must be fully drained before the replacement writer set starts; no rolling
coexistence or historical partial-purchase repair is claimed. Caller-context,
commit ownership, and whole-purchase atomicity belong to the API coordinator.

## Stock lock signature

`TakeStock` uses PostgreSQL's two-`integer` transaction advisory lock with the
unchanged `(serverID, offerID)` keys (both Go `int32`). PostgreSQL has no
`(bigint, bigint)` overload. The lock covers the existing stock check and purchase
row insert; it does not extend to the service's wallet, grant, or daily counter.
Tests verify exact-key blocking, independent servers, rollback after timeout,
sold-out rejection, fresh-pool persistence, and concurrent takes of one offer.

## Dormant purchase planning prerequisites

`PreparePurchase` uses a deep copy of the exact constructor catalog, rejects
invalid/overflowing prices and quantities, aggregates duplicate item costs in ID
order, and retains gold/silver aliases in the scaled cost snapshot. It does not
read balances, decide caps, or mutate persistence. No new offer is activated.

`PlanPurchase` consumes raw locked facts and samples the service clock once. This
is decision/linearization time after wallet/items/offer/counter locks, not commit
time: an allocator or receipt wait can cross midnight without changing the plan.
Daily limits retain precedence over lifetime limits; both counter columns are
checked for overflow, total always increments, and civil-date/DST rules above
remain unchanged. Plans return copy-only costs, reward, and final offer view.

The dormant PG ports require caller-owned actor → existing wallet → sorted items
locks, then acquire finite-offer → counter → allocator locks. They query only the
supplied transaction; the wallet protects absent counters. Any participant error
requires caller rollback. State binds intent/store/tx and can be recorded once.
The per-server append-only MAX+1 allocator uses `(-1397247824, serverID)` as two
int32 keys, distinct from positive stock/PLAY/CITY keys, checks int64 exhaustion,
and holds through commit. No pruning, client idempotency, replay, or DDL is added.
Unlimited purchases now have ledger rows through this port. Scaled price snapshots
preserve resource aliases; timestamps are decision time and dates are civil labels.

Legacy `TakeStock` also takes offer → allocator (never wallet/counter after the
allocator) and records unlimited rows, with `{}` cost because it has no catalog.
It remains stock-only, not purchase-atomicity evidence. Old full orchestration
is blocked by the S4 guard above; incompatible older binaries must still be
fully drained during coordinated S4+A4 activation. Finite display subtracts sold
in int64 first.

`ListShopShelfContext` propagates request cancellation and stock/counter errors;
the legacy list signature delegates to it. A failure returns no partial offers,
so an unavailable read cannot masquerade as a successful empty/zero refresh.

The dormant port tests use actual disposable PG and independent pools. They cover
last daily/lifetime units, last finite stock, fresh-pool reads, counter exhaustion,
cancellation at offer/counter/allocator locks, and midnight while queued. The
clock test waits for PG's observed lock wait: business locks defer the sample,
whereas allocator waits retain the prior decision day. This establishes SHOP
participant behavior only; whole wallet/items/receipt atomicity and route rollout
still require the independent CONTENT/API/client integration and activation gates.
