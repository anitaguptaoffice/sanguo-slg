# CLT-SHOP-OUTCOME / UI1 prerequisite

`shopOutcome` reads authenticated bag, city wallet and shelf together, with the
existing shared asset epoch, snapshot-reference and caller actor/lifecycle guards.
It returns unpublished replacement snapshots, never a grant delta or purchase receipt.
One failed/stale read invalidates the aggregate; retry is reads only. City reads may
settle resources and bag reads retain the fixed-key starter hook.

The old backend is not atomic. In particular sold-out/insufficient-item errors can
follow a debit, so those remain unknown. Only narrowly identified pre-write rejects
are classified as known; neither class promises rollback or browser exactly-once.
No catalog, count, price, protocol, backend or DB changes are included.

Focused prerequisite: `npm test -- src/net/shopOutcome.test.ts`.

UI1 integration: ContentPanels gates one actor-owned action, retains confirmed or
unknown outcome separately from reload warning, and discards actor/session/unmount
responses. Close does not cancel the submitted mutation or start hidden recovery;
reopen may refresh current state but never replay. Unknown remains explicitly unknown
after reads; any deliberate later buy is labeled a new purchase. Returned grant
quantities are already totals; current bag includes item-currency removal.

UI2: interrupted-flow DOM tests cover double clicks, close/reopen, actor/session
changes, old responses versus a new actor's inflight action, detached controls,
old bag/shelf reads, aggregate freshness and per-read failure. A new action clears
prior success stamps/links so an unknown result cannot inherit an earlier success.
Native fixture: `QA_OUT=/tmp/shop-ui node qa/shopOutcome.browser.mjs` at 1280×720
and 1600×900, sandbox enabled, actual existing SHOP paper skin and production CSS;
controlled gateway responses only, no native backend/PG or progression proof.

Independent review found a missing settlement boundary: a bag/city read begun
*during* the purchase could complete after a hidden success/unknown. Settlement
now advances the shared asset epoch only after confirming the original actor is
current, before the hidden-return path. This invalidates intervening reads without
starting hidden recovery; an obsolete actor/session result cannot invalidate new
actor reads. Regression includes production CityStateFetch and delayed bag reads.
