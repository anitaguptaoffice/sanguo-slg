# GetFirstCityResult passive settlement (local product policy)

When the stored command is **PENDING** and matches the actor **head** `command_id`, `attemptFirstCityGet` runs the same `settleFirstCityEffect` path as `ContinueFirstCity` (head+C1 checks on Continue only).

**Rationale:** polling Get after WS ACK-loss can finish intake without a separate Continue click; duplicate Get/Continue remain idempotent per command id.

**Not adopted:** settling pending records that are not the current head; Get does not return content/head conflict kinds (per FIRST-CITY-WIRE).