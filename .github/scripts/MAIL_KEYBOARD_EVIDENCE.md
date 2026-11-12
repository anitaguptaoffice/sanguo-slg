# Mail trace policy (CI-MAIL-EVIDENCE-CONTRACT-001, #2309)

Fresh pure implementation from main ddc80aab, not recovery of the historical
509-line candidate or its 64 tests. This component is NEVER MERGE and grants no
native acceptance. No network, browser, filesystem or SQL effects are performed.

`createMailVerifier({protoRoot, fixtureSpec})` consumes every real CDP protobuf
frame with its monotonic timestamp. Runtime validates socket origin/frame source.
Strict decoding rejects unknown/noncanonical fields. Natural fresh-demo startup
must perform failed Login, Register, Login, Enter, empty ListCities, CreateCity,
GetCityState. Account/player/server/city and the private session come from actual
responses. Only the finite normal read allowlist and armed mail reads are allowed.
All failures poison the verifier and emit a fixed safe error; evidence omits
credentials, session, trace IDs and raw bytes. Sanitized mail outputs are archived
only after semantic validation; invalid payloads are never copied to evidence.

Call beginFixtures(snapshot), acceptFixture(receipt, sent, received) per GM call,
finishFixtures(snapshot), then beginStep({expectedReadId:null|string}) and
endStep(snapshot). Brackets use the CDP monotonic clock, not wall-clock or JS time.
Each boundary is quiescent. The independent #2521 oracle owns full raw snapshot,
fixture, ownership, read-order and economy validation. This component instantiates
it directly, never accepts a preverified boolean. ids() and identity() expose only
sanitized fixture IDs/actor identity. finish(snapshot) requires all four reads.

COUNT/SELECT pairs may observe different canonical states. Every observation must
admit one common ordered set of actual mutation points inside GM/read brackets.
All feasible alternatives are retained, with a fail-closed 10,000-state resource
limit. Fixed and baseline runs share policy; pointer versus native input and
visible focus/geometry are separate scenario gates. Unit controls are not live
backend/browser evidence. Complete reviewed composition, exact source mapping,
mandatory CI and official native artifact review remain required before use.

Evidence preserves synthetic IDs, route/time/code, safe mail inputs and validated
outputs, GM/read windows, and canonical step boundaries for independent replay.
