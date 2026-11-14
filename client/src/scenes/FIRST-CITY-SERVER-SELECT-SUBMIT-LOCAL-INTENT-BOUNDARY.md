# ServerSelect Submit vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-LOCAL-INTENT-BOUNDARY-001 stacks on #2858.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **competing INITIAL Submit does not adopt journal's
latest local intent when durable head is command — head-gated Submit boundaries apply instead**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.3;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). `empty` head withholds the row (Submit form-local
path is #2759/#2765). Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCitySubmit` / `buildSubmitRequest` / journal. No automatic Submit, no main-city navigation, no playable-first-city claims.