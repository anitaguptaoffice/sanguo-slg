# ServerSelect proposal form vs durable head

CLIENT-FIRST-CITY-PROPOSAL-FORM-BOUNDARY-001 stacks on #2752.

When loopback knowledge has durable `head` = `command`, compares editable `fc-name` / `fc-x` /
`fc-y` to the head proposal. On mismatch, shows a read-only boundary row: **Continue sends head
proposal, not the form** ([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md)
§5.6; [FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). EMPTY head withholds the row
(Submit uses the form). Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.