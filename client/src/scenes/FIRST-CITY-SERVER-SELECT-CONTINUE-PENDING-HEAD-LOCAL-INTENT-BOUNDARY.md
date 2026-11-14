# ServerSelect Continue pending-head gate vs journal latest local intent

CLIENT-FIRST-CITY-CONTINUE-PENDING-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2989.

When loopback knowledge has durable `head` = **command · pending** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Continue pending-head gate follows resolveFirstCityContinuePendingHeadBoundaryView (explicit Continue on PENDING head sends head proposal only) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5–§6). Complements #2785 Continue pending-head boundary and #2764 Continue local intent without
changing `resolveFirstCityContinuePendingHeadBoundaryView` or `buildContinueRequest`. `empty` / non-pending `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue, no main-city navigation, no playable-first-city claims.