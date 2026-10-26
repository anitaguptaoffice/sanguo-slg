# Atomic SHOP integration participants

`lockShopWallet` and `debitShopWallet` are supplied-transaction API-owned wallet
participants. They do not activate a route or replace legacy SHOP orchestration.
The caller validates the actor, holds the existing wallet row, passes checked
server-derived costs, and rolls back on every participant error. Free purchases
still require an initialized wallet but do not rewrite its timestamp. Item/shop
SQL belongs to their own domains; no resource compensation or commit replay.

Local verification: `DATABASE_URL=... go test -race ./internal/api
-run '^TestShopPurchaseWalletPGCallerOwnership$' -count=1` exercises zero-cost
no-op/timestamp, all negative cost fields, insufficient balance, all currency
subtraction, caller rollback, missing wallet no-synthesis, and cancellation.
These helper tests do not establish whole-purchase atomicity or activation safety.

`purchaseShopAtomic` is a dormant coordinator until the reviewed activation card
switches the public route and guards incompatible legacy PG writers together.
It captures the exact SHOP service/store, CONTENT service/catalog/store, shared
cache and player pool at startup. It validates dependencies before opening a
READ COMMITTED transaction, then locks player identity, initialized wallet,
positive inventory and SHOP facts in that order. SHOP samples business-decision
time after those locks; allocator/receipt waiting does not imply commit-time dating.
Wallet, item currencies, ledger/counter and exact create-only item receipt share
one commit. All precommit errors roll back. Commit errors remain unknown and
must never be replayed or compensated. Cache invalidation/DOM refresh failures
after confirmed commit are diagnostic, not failed purchases. Fixed price, catalog,
count units, daily precedence, and resource aliases remain unchanged.

Focused actual-PG tests cover bound production offer1001, count2 scaling, exact
shop receipt/restart, daily-cap rejection, and separate synthetic mixed/item-only/
free offers. Synthetic offers are fixtures, not new live catalog entries. Full
failure/concurrency/client review and writer activation remain separate gates.

Fault tests exercise actual database failures after wallet/currency/ledger/counter/
receipt/reward writes and a deferred commit failure, requiring all five business
components unchanged and no cache publication. Cancellation after each real write
must roll back before commit. A wrapper that commits PostgreSQL then loses the
response proves one durable purchase, one receipt, no replay and no public result.
Confirmed commits survive cache read failure. Missing/foreign bindings, catalogs,
actor/account/wallet, insufficient currencies and max-stack reject nonmutatingly.

Independent-pool concurrency tests serialize 24 requests at the last daily cap,
12 different players at the last finite units, and different offers spending the
same scarce item currency. Exact durable debit/grant/ledger/receipt/count totals
are checked. Wallet-wait cancellation and provenance rejection before BeginTx
remain nonmutating. These are isolated fixtures, not natural-play acceptance.

Unconfirmed commit diagnostics retain server/player/offer and reserved purchase/
grant IDs even though no provisional response snapshot is returned. These IDs are
operator audit clues, not a client request key or permission to replay a purchase.

Activation group: the gateway purchase route uses only the API transaction owner;
nonzero body-shard mismatch is rejected, count<=0 still defaults to1, and only
confirmed success emits shop_purchase. Shelf refresh uses contextual reads with
exact captured binding and never substitutes empty/partial data on read failure.
Public messages are fixed safe strings; unexpected/commit errors remain unknown.
This API switch and SHOP's explicit-memory-only legacy guard are indivisible.
Do not deploy either alone or coexist with old in-flight SHOP writers. Integrate
only after independent final group/client review and real-PG/aggregate gates.
The activation fixture checks actual gateway receipts/counters, unknown response
and SQL sanitization, no false success events, count defaults and failed shelf reads.
