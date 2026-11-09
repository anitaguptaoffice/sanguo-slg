# CLIENT-CONNECT-DEADLINE-001

Gateway connection attempts have a 15-second handshake deadline. A silent
CONNECTING socket now rejects and is closed, letting the existing server
selection error path release Refresh instead of leaving it disabled forever.
Only an explicit refresh starts another connection. No authentication or
game command is automatically sent or replayed.

Open, early error/close, timeout, explicit client close and replacement all
settle the pending attempt once and release its timer. Cancellation fences
the old socket before closing it, including when browser close delivery is
delayed. Queued old open/error/close callbacks cannot affect its replacement.
Replacing an established connection closes its old socket; ordinary live
error/close notifications and session invalidation remain in place.

The deadline is a JavaScript timer, not a promise of 15-second wall-clock
precision while a tab is suspended. It does not change request deadlines,
server commits, reconnection policy or uncertain-command retry semantics.

`GatewayConnectLifecycle.test.ts` covers silent handshakes and terminal/stale
event races. `ServerSelectScene.connectionRecovery.test.ts` exercises the
actual scene, GatewayClient and canonical protobuf packets through explicit
refresh. Transport events and clocks are controlled substitutes, not native
browser/network acceptance or a claim that the complete game is playable.
Run `npm test` and `npm run build` from `client/`.
