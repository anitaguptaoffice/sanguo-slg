# ServerSelect Submit rejected-head gate vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-REJECTED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3001.

When loopback knowledge has durable `head` = **command · rejected** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Submit rejected-head gate follows resolveFirstCitySubmitRejectedHeadBoundaryView (Submit disabled on rejected head; successor INITIAL needs new commandId + exact rejected predecessor) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §3 / §5). Complements #2771 Submit rejected-head boundary and #2861 Submit local intent without
changing `resolveFirstCitySubmitRejectedHeadBoundaryView` or `buildSubmitRequest`. `empty` / non-rejected `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.