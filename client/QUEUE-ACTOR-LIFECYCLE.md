# CLIENT-QUEUE-ACTOR-LIFECYCLE-001

Task: https://github.com/anitaguptaoffice/sanguo-slg/issues/2007

Queue speedup responses formerly fetched the current session after awaiting UseConsumable, allowing an old request to overwrite a later player's bag and trigger a city read for that player. Queue refreshes also accepted older overlapping reads, and the click continuation displayed success even after a refresh error.

Requests now capture the existing actor/server/city/auth-generation context and panel mount. Only the owning current context accepts state, status and callbacks. Refresh additionally uses a latest-request generation; an old finally cannot clear a newer loading indicator. Rendering discards loading/error state owned by an obsolete context so it cannot hide the new context’s controls. Speedup uses an operation-owned lock, so repeated submissions coalesce and an obsolete completion cannot release a new operation's lock. Reattach resets operation state. Recruit-completion iteration stops when its original context is lost. Successful current speedups still update the bag and refresh the city; current failures remain visible, and explicit retry remains available. Generic refresh success is emitted only inside a successful current read.

This is client response ownership only. Already submitted server commands cannot be canceled. No automatic replay, compensation, refund, new city target, protocol change, or backend atomicity claim is introduced. Existing server speedup target selection and item-debit/effect failure windows remain unchanged. A successful command followed by a failed state read is not resent; refresh can reconcile the city.

## Verification

`cd client && npm test -- src/ui/QueuePanels.lifecycle.test.ts src/ui/QueuePanels.test.ts`, complete `npm test`, and `npm run build`.

Actual panel events with deferred mocked RPCs prove old success/error isolation across actor changes, same-actor relogins, city changes and remounts; latest-read ordering; operation-owned busy state; no duplicate submission/replay; current success/error/retry; and truthful refresh status. No new controls/layout/assets or server behavior change. These are client integration tests, not real browser/live-server acceptance. Full applicable tests, independent final-tree review and exact-head CI remain required; if another acceptance gate is identified, retain Draft until satisfied. No deployment implied.
