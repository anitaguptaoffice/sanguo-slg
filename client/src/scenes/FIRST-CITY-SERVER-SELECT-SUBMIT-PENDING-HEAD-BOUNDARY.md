# ServerSelect Submit gate vs pending durable head

CLIENT-FIRST-CITY-SUBMIT-PENDING-HEAD-BOUNDARY-001 stacks on #2777.

When loopback knowledge has durable `head` = **PENDING command**, shows a read-only boundary row:
**Submit stays disabled outside EMPTY head; competing EMPTY INITIAL against PENDING returns HEAD_CONFLICT**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §5;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5).
`empty`, `succeeded`, and `rejected` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCitySubmit` EMPTY-only wiring. No automatic Submit, no main-city navigation, no playable-first-city claims.