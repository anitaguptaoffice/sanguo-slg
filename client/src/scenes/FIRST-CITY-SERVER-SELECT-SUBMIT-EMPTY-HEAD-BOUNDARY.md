# ServerSelect Submit gate vs EMPTY durable head

CLIENT-FIRST-CITY-SUBMIT-EMPTY-HEAD-BOUNDARY-001 stacks on #2795.

When loopback knowledge has durable `head` = **EMPTY**, shows a read-only boundary row:
**V2 Submit is enabled with EMPTY predecessor; Continue stays PENDING-only**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`pending`, `rejected`, and `succeeded` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCitySubmit` / `buildSubmitRequest` / journal; no automatic Submit, no main-city navigation, no playable-first-city claims.