# Shared military source PostgreSQL acceptance

`API-MIL-SHARED-PG-001` (#2425) is the mandatory companion to #2422 / #2424.
It runs the two real initializer transactions against the existing owned PG17
fixture and independently enumerated inventories. It never manufactures an
Owner, participant, transaction result or enrollment proof.

The success case checks all eight concrete participant handles, fixed nine and
twelve pins, exact shared Binding/admission, caller replacement isolation and
one-shot aliases. A Return-only OID mismatch proves first-child success cannot
leave a usable partial pair. The tracer gates only the second initializer.
Concurrent aliases, copied close, cancellation during constructor or rollback,
constructor panic and real rollback failure cover the shared lifetime. Only
the witnessed owned fixture backend is terminated for the unknown case.
Unknown remains pending through cancellation, repeated close/wait and aliases.
Canceling the caller during independent rollback does not cancel its cleanup.

Both rollback contexts must remain fresh and bounded by five seconds. Every
case checks all fixture table values/xmin/ctid and sequence state unchanged,
plus released schema locks. Gate/goroutine cleanup remains bounded on failure.
These are local source validation transactions, not business gameplay writes.

Run the existing full API PostgreSQL CI in both ordinary and race modes.
DATABASE_URL absence produces a skip locally, never acceptance. No workflow,
schema, runtime or held-source change belongs to this card. Source plus this
companion require independent composition review and all exact-head CI before
either merge, followed by final main/push verification.
