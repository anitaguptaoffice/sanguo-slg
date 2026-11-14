# ServerSelect Submit new commandId form vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-FORM-LOCAL-ID-LOCAL-INTENT-BOUNDARY-001 stacks on #2945.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **Submit new commandId boundary display follows resolveFirstCitySubmitFormLocalIdBoundaryView (only when head=empty and form fields match journal) —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.3 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2765 Submit commandId boundary without
changing `resolveFirstCitySubmitFormLocalIdBoundaryView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.