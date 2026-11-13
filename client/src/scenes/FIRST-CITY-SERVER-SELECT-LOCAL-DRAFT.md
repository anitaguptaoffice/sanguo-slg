# ServerSelect same-ID local draft divergence

CLIENT-FIRST-CITY-LOCAL-DRAFT-001 ([#2699](https://github.com/anitaguptaoffice/sanguo-slg/issues/2699)) stacks on #2695.

Loopback ServerSelect V2 first-city panel shows **read-only** rows when a retained **local** intent shares
`commandId` with a durable server `FirstCityKnowledge.records` entry but proposal fields diverge (per reducer).
Non-head losers remain on #2695; canonical winner remains on #2692. Stale-actor, unavailable and incomplete
evidence withhold the display. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.
