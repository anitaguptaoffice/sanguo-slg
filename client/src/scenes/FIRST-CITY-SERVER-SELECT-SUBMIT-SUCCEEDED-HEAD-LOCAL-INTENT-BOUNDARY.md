# ServerSelect Submit succeeded-head gate vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-SUCCEEDED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3030.

When loopback knowledge has durable `head` = **command · succeeded** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Submit succeeded-head gate follows resolveFirstCitySubmitSucceededHeadBoundaryView / canOfferFirstCitySubmit (EMPTY-only INITIAL Submit) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2793 Submit succeeded-head boundary and #2861 Submit local intent without
changing `canOfferFirstCitySubmit` / `resolveFirstCitySubmitSucceededHeadBoundaryView`. `empty` / non-succeeded `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.