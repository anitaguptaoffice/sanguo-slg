# ServerSelect Submit form vs retained local intent

CLIENT-FIRST-CITY-SUBMIT-FORM-LOCAL-BOUNDARY-001 stacks on #2756.

When loopback knowledge has durable `head` = `empty`, compares editable `fc-name` / `fc-x` / `fc-y` to the
**latest** journal-retained local intent. On mismatch, shows a read-only boundary row: **Submit sends form
values with a newly generated commandId, not the retained local intent**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.3;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). `command` head withholds the row (Continue
path is #2756). Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.