# Purchase settlement before bag reads

Opening Bag while a shop purchase is pending previously advanced the shared
asset epoch before the purchase receipt arrived. Even strictly FIFO responses
then discarded its full wallet, including gold. City-resource recovery cannot
recover that gold, so a paid purchase could leave obsolete affordability shown.

ContentPanels now keeps an actor-owned settlement promise for its purchase.
Bag navigation remains immediate, but its requested read waits before advancing
asset freshness or dispatching ListPlayerBag. The latest still-current bag read
runs after settlement; repeated requests coalesce. Navigation away, actor/session
change and detach discard obsolete waiters. Detach releases its owned wait;
normal success, rejection and unknown outcomes release through finally.

Existing purchase validation, full-receipt guards, superseded/unknown outcome
semantics and read-only recovery are unchanged. No mutation is repeated, no
balance is inferred, and unrelated writers still supersede stale receipts.

The dedicated regression uses production panels, GatewayClient and protobuf
with strictly ordered controlled transport responses. It covers zero gold,
visible inventory/affordability, read failure/retry and interrupted ownership.
Unknown item-use recovery also leaves the deferred loading state on success or
failure, including reopening after close, panel replacement or detach/remount
abandons a waiting read. Failed recovery permits only read retry; neither
mutation is resent.
This is not native-browser, live-economy or deployment acceptance.
