# ServerSelect COMMAND outcome read-only display

CLIENT-FIRST-CITY-COMMAND-OUTCOME-001 stacks on #2725.

Loopback ServerSelect V2 first-city panel shows **read-only** rows for retained `command` observations from
Submit/Continue/GetResult: the requested `commandId` and the observation's **server-retained record** (name/coordinates/state).
This is wire COMMAND read-only playback (FIRST-CITY-WIRE.md §5), not command lookup NOT_OBSERVED or actor discovery EMPTY.
Canonical winner, conflict, pending intake, terminal receipt and discovery EMPTY stay separate. Stale-actor, unavailable and
incomplete evidence withhold the display. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.
