# Owned fixed-delay server launcher

CI-CHAT-DELAY-SERVER-001, issue #2292. Draft-only QA, NEVER MERGE.
Depends on reviewed relay d512df7415f9cee85efb55d73b5ff6238d0783b8;
no old runtime/scenario file is changed or copied into this component.

Set QA_SERVER to this executable and QA_ACTUAL_SERVER to the original built
$RUNNER_TEMP/live-chat-unicode-server; QA_ACTUAL_SERVER_SHA must match SHA256.
QA_OUT selects the existing evidence directory. Native use requires official Actions.
Only the child's existing HTTP_ADDR changes to127.0.0.1:18080. The relay exposes8080,
so the immutable runtime/client/health URLs and bootstrap/seed/restart stay unchanged.
No decoding, response forgery, protocol changes, external peers or new services.

Readiness reserves/checks upstream loopback port, starts an owned real child,
checks its actual health, then binds the byte relay. Startup failures clean owned
resources and are not native passes. SIGTERM/SIGINT are idempotent requested stops.
Relay stops accepting/drains/FIN-closes with2s deadline; child gets SIGTERM with5s
budget inside one8s deadline, with bounded startup/relay waits and finalization.
Forced cleanup/any error fails; late acquisition is disposed. No foreign kill/retry.
Each bootstrap/server launcher writes its own PID/sequence-named lifecycle report.
The immutable runtime sees only launcher exit: controlled acceptance MUST additionally
validate the real-child PID/ownership/requested exit0 and the complete relay report.
Hashes prove relay writes, not peer receipt. Full real native Reply/PG/List still required.

Local tests spawn owned Node HTTP fixture children, never cmd/server or Chromium.
They require the reviewed relay module alongside these files in a disposable staging
folder; these fixtures cannot establish product/native acceptance. Run the test file
with Node; official Node22 and whole-composition review remain mandatory.
Old run42432302931's consumed natural pending trial remains UNOBSERVED.
