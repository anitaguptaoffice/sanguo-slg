# ServerSelect Submit new commandId vs retained local intent

CLIENT-FIRST-CITY-SUBMIT-FORM-LOCAL-ID-BOUNDARY-001 stacks on #2764.

When loopback knowledge has durable `head` = `empty`, compares editable `fc-name` / `fc-x` / `fc-y` to the **latest** journal-retained local intent.
When proposal **fields match**, shows a read-only boundary row: **Submit still mints a new commandId, not the journal's retained commandId**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.3;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Field mismatch withholds this row (#2760 covers content divergence).
`command` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.