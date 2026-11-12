# Controlled chat readback oracle

CI-CHAT-CONTROLLED-SCENARIO-001, issue #2303. Draft QA, NEVER MERGE.
Run42436958735 remains FAILED: five real Send commits, four full ordinary cases,
two valid fifth-message Lists, no sixth pending Send (NOT_RECORDED/unconsumed).
Normal post-Send refresh and five-second HUD polling can both read messages.
This does not imply duplicate Send or a product defect.

Immutable runtime6889bc77 and original scenariof48b1d64 remain unchanged.
Original90-control suite still runs. Native scenario body is copied transparently,
with byte-comparison excluding only two explicit full-session readback checks.
Original input/rejection/baseline/inventory/strict overlap helpers are reused.
All six sends, native keyboard actions, counters/drafts/reopen, strict pending501,
preservation and subsequent local rejection remain mandatory, with no retry.

Every observed List is retained and validated: exact destination/pagination,
unique ordered trace IDs/timestamps, successful complete response, ordered unique
message IDs, own actor, valid content/time/targets and all eight stable fields.
Every post-reply List must include each already-replied Send exactly once.
Earlier/inflight reads may omit a future message; any returned copy must match.
Final session attribution rejects every message absent from real successful Sends,
including valid-looking extra own-actor rows. Baseline permits only empty Lists.
No good response can hide a bad earlier, overlapping or later response.
Optional display-name differences are explicit for every attributable listed copy.

No product/server/protocol/network changes. No polling suppression or fake data.
No native execution from this component alone. C requires exact reviewed mapping,
all old/new suites, same-event disabled witness, six-row PG and clean owned shutdown.
Old natural trial remains consumed/UNOBSERVED, source/QA holds unchanged.
