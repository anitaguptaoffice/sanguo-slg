# ServerSelect actor discovery EMPTY read-only display

CLIENT-FIRST-CITY-DISCOVERY-EMPTY-001 stacks on #2721.

Loopback ServerSelect V2 first-city panel shows **read-only** actor discovery EMPTY copy when durable `head` is
observed `empty`: §10 INITIAL #1 semantics (not command lookup NOT_OBSERVED, does not prove prior packets failed).
`head=null` / incomplete evidence withholds the display. Command heads hide this row. Canonical winner, NOT_OBSERVED,
pending intake and terminal receipt stay separate. No automatic Continue/Submit, no main-city navigation, no
playable-first-city claims.
