# PostgreSQL march claim transaction

`Service.ClaimForMarch` keeps its existing identity, owner, status and office
prechecks. A real `PGStore` then locks the owned hero, rechecks current eligibility,
locks its force row, and commits the existing force calculation and status change
together. Only status is updated on the hero. Missing force is initialized under
the hero lock. Existing lazy force-table setup completes before the transaction.

A definite local write failure leaves neither debit nor status change committed.
An insufficient-force rejection preserves stored force and regeneration time,
including elapsed regeneration that still leaves less than the existing cost.
Concurrent claim transactions serialize on the hero row. Commit errors remain
uncertain: no automatic retry, compensation or refund is introduced. A later MIL
creation rejection still does not refund the successfully committed claim cost.

The optional capability is outside `Store`. Memory/custom stores and wrappers
embedding only `Store` retain the old path. Wrappers embedding `*PGStore` opt in;
their `GetHero`/`SaveHero` overrides do not replace the locked internal SQL. Existing
API fault wrappers therefore are not evidence for the new PostgreSQL path.

The separately registered API real-PG companion is required before merge. It must
prove production wiring, rollback, actual lock contention, exact durable values,
and ordinary/race execution on the same reviewed source. No local Go/PG execution
is claimed when unavailable; unit compilation alone is not PG acceptance.

This is not shared serialization with RestHero, detail regeneration, office,
upgrade, expression, stale ReleaseFromMarch or other snapshot writers. It adds no
claim generation, orphan scan or restart recovery. It does not activate durable
MIL persistence or alter deployment gates. Existing PG claims do use this fix.
