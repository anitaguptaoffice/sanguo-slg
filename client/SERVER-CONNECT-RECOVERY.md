# Server-selection connection recovery

CLIENT-SERVER-CONNECT-RECOVERY-001, issue #2045. Client scene only; GatewayClient/authentication/protocol are unchanged.

Initial entry and explicit Refresh now share one owned connection/list operation. After initial connection failure or socket closure, Refresh establishes a connection before listing servers. Normal list errors on an open connection retry only the list. No automatic reconnect loop or bootstrap/login/create-city replay is introduced.

Existing gateway close/error callbacks invalidate the connection and list generation, clear stale server choices and disable entry, then expose Refresh. Close before socket-open also releases the scene wait even though GatewayClient's original promise may remain pending. Lifecycle and connection identity exclude old callbacks; list identity excludes a response arriving after disconnect. In-flight bootstrap is still single-flight and cannot transition into main city after disconnect. Already submitted server commands cannot be canceled.

Base reproduction: six new failures and four passing controls. Mounted scene tests cover explicit recovery, failed retry, concurrent clicks, close-before-open, lifecycle replacement, stale list results and live list errors. A local fake-WebSocket integration exercises the real GatewayClient and real protobuf request/response encoding; it makes no network connection. Native browser/live gateway acceptance is not claimed, and denied browser launch was not retried. Full suite/build, independent final-tree review and exact-head/main CI are recorded in the PR. No held files or deployment changes.
