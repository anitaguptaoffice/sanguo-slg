# ServerSelect Submit empty-head gate vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-EMPTY-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2967.

When loopback knowledge has durable `head` = **empty** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Submit empty-head gate follows resolveFirstCitySubmitEmptyHeadBoundaryView / canOfferFirstCitySubmit (empty head only) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2795 Submit empty-head boundary and #2967 Submit commandId boundary without
changing `canOfferFirstCitySubmit` / `resolveFirstCitySubmitEmptyHeadBoundaryView`. `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.