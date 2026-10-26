# CLIENT-HOTEL-OUTCOME — current-state recovery

A successful hotel action response is retained in its own status line. Failure of a
subsequent hero, wallet, bag or pool reload does not turn that confirmed result into
purchase failure. Both recruitment and paid refresh share an in-flight guard.

Timeout, connection loss and unrecognized/unavailable errors have an unknown outcome.
The client never says they were uncharged or rolled back, never retries a purchase,
and keeps that uncertainty after recovery. Known existing gameplay rejections retain
their existing hints. Repeated clicks, panel close/reopen, actor/session changes and
late detached responses cannot resubmit the action or publish old actor results.

“重新加载当前状态” calls existing hero, wallet, bag and hotel-list RPCs, not the
purchase RPC. Snapshot replacement uses actor/session generation, shared asset-read
epoch and wallet/bag reference guards; no receipt amount is added/subtracted locally.
A complete current snapshot permits a **new explicit** action. It does not identify
whether a previous unknown action committed. Candidate disappearance is not a receipt:
list can synchronize the pool, and bag reads can run existing starter grants.

No protocol, costs, rules, receipt ledger, idempotency or server guarantees are added.
These are local client repairs only; coordinated compatible hotel/family server
activation remains a separate prerequisite under `spec/rules/hotel_transactions.md`.

Validation: `npm run build`, unfiltered `npm test`, and
`PLAYWRIGHT_BROWSERS_PATH=/tmp/sanguo-playwright node scripts/verify-hotel-outcome.mjs <output>`.
The browser runner uses production DOM/CSS and explicit fixture GatewayPort responses,
including an aborted HTTP read after confirmation and simulated lost-response timeout.
It is sandboxed Chromium UI evidence, **not** PostgreSQL/production transaction proof.
