# ServerSelect Continue succeeded-head gate vs journal latest local intent

CLIENT-FIRST-CITY-CONTINUE-SUCCEEDED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3036.

When loopback knowledge has durable `head` = **command · succeeded** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Continue succeeded-head gate follows resolveFirstCityContinueSucceededHeadBoundaryView / canOfferFirstCityContinue (PENDING-only Continue) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2796 Continue succeeded-head boundary and #2764 Continue local intent without
changing `canOfferFirstCityContinue` / `resolveFirstCityContinueSucceededHeadBoundaryView`. `empty` / non-succeeded `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue, no main-city navigation, no playable-first-city claims.