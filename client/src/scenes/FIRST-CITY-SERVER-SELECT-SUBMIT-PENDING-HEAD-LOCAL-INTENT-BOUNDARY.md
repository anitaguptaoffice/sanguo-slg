# ServerSelect Submit pending-head gate vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-PENDING-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2995.

When loopback knowledge has durable `head` = **command · pending** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Submit pending-head gate follows resolveFirstCitySubmitPendingHeadBoundaryView (INITIAL Submit only on EMPTY head; no competing EMPTY INITIAL on PENDING) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5–§6). Complements #2781 Submit pending-head boundary and #2861 Submit local intent without
changing `resolveFirstCitySubmitPendingHeadBoundaryView` or `buildSubmitRequest`. `empty` / non-pending `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.