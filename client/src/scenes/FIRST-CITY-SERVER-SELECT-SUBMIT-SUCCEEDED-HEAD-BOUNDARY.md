# ServerSelect Submit gate vs succeeded durable head

CLIENT-FIRST-CITY-SUBMIT-SUCCEEDED-HEAD-BOUNDARY-001 stacks on #2784.

When loopback knowledge has durable `head` = **succeeded command**, shows a read-only boundary row:
**Submit stays on EMPTY head only; SUCCEEDED head rejects competing EMPTY INITIAL**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(7);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5).
`empty`, `pending`, and `rejected` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCitySubmit` EMPTY-only wiring or `buildSubmitRequest`. No automatic Submit, no main-city navigation, no playable-first-city claims.