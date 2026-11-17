# Controlled paid-schedule advancement

API-RECRUIT-COMPLETE-TIME-PG-001 (#3087) replaces business-duration polling in
five completion test fixtures. Actual paid admission and its independent assertions
run first; actual completion must return Early without any durable change.
An owned transaction shifts queue and receipt timestamps by one hour, with exact
identity, status and previous timestamp guards and one affected row per statement.
Non-time fields, unrelated relations and sequences remain unchanged. Duration and
receipt equality are checked, and replay expectations move with the fixture.

Completion/promotion snapshots are captured after advancement. Existing MVCC,
credit, capacity, rollback and replay assertions remain. Production uses its actual
PostgreSQL clock; this is controlled-time evidence, not natural waiting. Exact
boundary semantics belong to clock-controlled domain tests. No production change.
