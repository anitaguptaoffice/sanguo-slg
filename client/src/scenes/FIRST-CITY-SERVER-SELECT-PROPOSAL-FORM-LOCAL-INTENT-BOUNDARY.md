# ServerSelect proposal form vs journal latest local intent

CLIENT-FIRST-CITY-PROPOSAL-FORM-LOCAL-INTENT-BOUNDARY-001 stacks on #2928.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **proposal form boundary display follows durable head proposal vs current form —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.6 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2756 proposal form boundary without
changing `resolveFirstCityProposalFormBoundaryView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.