# ServerSelect durable head terminal receipt display

CLIENT-FIRST-CITY-TERMINAL-RECEIPT-001 ([#2716](https://github.com/anitaguptaoffice/sanguo-slg/issues/2716)) stacks on #2714.

Loopback ServerSelect V2 first-city panel shows **read-only** terminal receipt fields when durable `head` is a
`succeeded` or `rejected` command: wire-frozen creation IDs and constants, or durable rejection reason.
Canonical winner, conflict, NOT_OBSERVED and other lines stay separate. `pending` / EMPTY head hides this row.
Stale-actor, unavailable and incomplete evidence withhold the display. No automatic Continue/Submit, no main-city
navigation, no playable-first-city claims.
