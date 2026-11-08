# Separate controlled-network Unicode chat acceptance
CI-CHAT-DELAY-ACCEPTANCE-001, issue #2293. Draft QA, NEVER MERGE.
Profile localtcp-s2c500-c2s0-v1: every loopback server-to-client TCP byte receives
at least500ms residence; client-to-server has no added delay. Product/protocol unchanged.
This tests CLIENT pending delivery, not whether the server has already committed.
Old natural run42432302931 remains NOT PASSED / consumed pending UNOBSERVED.
Exact frozen helper7dc5939, runtime6889bc77, scenariof48b1d64 stay byte-identical.
New relayd512df74 and launcherbd5a2060 are independently source/mapping approved.
Workflow checks complete SHAs/trees/parents, builds real95b66a8 product and baseline,
runs full product tests/build BEFORE QA staging and runs every full control suite.
Real cmd/server, own fresh account, disposable PG17/Redis7 and sandbox Chromium only.
The original six actual sends, all counters/drafts/rejections/reopen and strict trusted
501 event interval inside actual Send/Reply remain mandatory. Passive extra listener
correlates disabled state to that SAME original event index/time/value, never a later sample.
After genuine response, preserved501 must reject locally without a seventh RPC.
Read-only PG snapshot requires exactly six matching committed rows, plus real List/body.
Proxy hashes attest submitted bytes, not peer receipt; real replies/persistence are separate.

controlledAcceptance starts false. It becomes true ONLY after original gates AND new
witness/PG checks AND both launcher real-child and relay closed/clean reports pass.
Original fixedAcceptance/runtime passed alone is insufficient; baseline has a separate flag.
Failures/unknown results preserve artifacts and forbid replay or delay tuning.

Initial opened run42436305827 failed before product/control/native execution: the YAML
literal's trailing newline caused an empty shell dependency iteration. Trial not consumed.
Both loops now ignore empty rows; all five exact pins and full suites remain mandatory.
One replacement trigger: PR2300 synchronize, before c83f03bdb54c45ffcb20e3a812ef13149c3a187c,
after equal current head, run_attempt1, own repository and exact branch
fix/ci-chat-delay-acceptance-001. Later transitions and manual reruns fail closed.
No old trigger paths/ref changes, natural retry, hold release or new same-card PR.
