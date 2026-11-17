# CLIENT-GATEWAY-WAIT-CLEANUP-001

Each in-flight gateway request owns one message listener, one close listener
and its existing 15-second timeout. Matching success, timeout, socket close
and synchronous send failure all remove those listeners and clear the timer.
This prevents timed-out calls from decoding every later response and makes
disconnect failures visible immediately instead of after the timeout.

Cleanup is request-local: unrelated trace IDs do not finish a request, and
completing one request does not remove another request's listeners. Existing
socket onclose callbacks and session-generation invalidation stay unchanged.

No request is resent automatically. A timeout or disconnect can still mean
that a server-side command executed without its reply reaching the client;
this change does not report rollback, success or permission to retry.
Malformed packet handling and connect lifecycle behavior are unchanged.

A counted WebSocket event substitute with fake timers covers success,
unrelated traces, repeated timeouts, late replies, send exceptions,
concurrent requests, remote close and explicit client close. Five tests
failed against the original implementation. These deterministic transport
lifecycle tests are not a real-browser or production-network acceptance run.
