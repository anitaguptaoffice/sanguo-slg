# Fixed-delay TCP transport fixture

CI-CHAT-TCP-DELAY-001, issue #2291. Draft QA ONLY, NEVER MERGE.
This is a separate controlled network experiment. Natural run42432302931 remains
UNOBSERVED; this helper cannot convert that result to PASS.

createRelay() uses only Node net/crypto/performance and fixed loopback endpoints:
127.0.0.1:8080 -> 127.0.0.1:18080. Every downstream byte waits at least500ms;
upstream bytes have zero added delay. No HTTP/WebSocket/protobuf parsing or changes.
No dynamic delay switching, message replay, reconnect, remote endpoints or installs.
Fixture options only permit bounded loopback ports/caps for pure Node tests.

Each direction preserves FIFO and records arrival, eligibility, immediate write-start
and callback completion. write(false) is already accepted, never written twice.
Pending caps count queued AND in-flight data until callback or failed-abort disposal.
Pause threshold64KiB; per-connection1MiB, aggregate4MiB, concurrent16, lifetime64
connections and4096 chunk records per connection. Exceeding any limit fails closed.
EOF propagates only after queued writes finish; the opposite half remains usable.
Stop drains queues, requests FIN, waits2s, then marks forced cleanup as failure.

Only counts/offsets/times/whole-stream hashes persist, never bytes or credentials.
Input/output hashes attest relay submission, NOT peer receipt. Actual TCP fixture
receivers compare bytes; native genuine Reply and PG/List remain separate gates.
The returned failure promise resolves on the first failure; launcher must stop.
Only clean report.errors=[], stopped=true, zero pending, matching stream hashes
and closed owned sockets can contribute to controlled acceptance.

Run: node .github/scripts/live_chat_tcp_delay.test.mjs
Local Node fixtures are not browser acceptance; official Node22 must also pass.
