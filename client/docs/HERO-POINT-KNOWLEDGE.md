# Hero potential after re-entry

CLIENT-HERO-POINT-KNOWLEDGE-001 / #2074.

GetHeroDetail returns current attributes but not allocated-point additions or remaining potential
(internal/api/hero_handlers.go and hero.proto). A fresh panel therefore cannot infer zero allocation
or a full available budget from the hero's level. No snapshot is cached without allocation knowledge.

The existing potential summary reports unknown allocation until an AddHeroPoint/ClearHeroPoint
receipt establishes it. Both existing buttons remain available for explicit user actions when
allocation is unknown; the server remains authoritative for ownership, idle status, targets and
budget. ClearHeroPoint currently resets points without charging items or gold
(internal/hero/points.go); this fix does not automatically reset, replay, or charge anything.
Known zero allocation still disables reset, and known exhausted potential still disables adding.
Previously observed receipt snapshots retain their actor ownership and level-budget behavior.

Regression evidence uses GatewayClient production protobuf encode/decode with a mounted hero
panel and an already allocated hero: no invented fields, no automatic reset, exhausted-budget
rejection followed by explicit reset/reallocation, partial allocation, and failed reset/no replay.
Existing ownership and upgrade tests cover actor changes and preserved successful receipts.
Server responses in the test transport follow inspected production semantics; this is not a live
Go/PostgreSQL or browser acceptance claim. No new layout/control, protocol, or backend change.
