# ServerSelect durable head PENDING intake display

CLIENT-FIRST-CITY-PENDING-INTAKE-001 stacks on #2717.

Loopback ServerSelect V2 first-city panel shows **read-only** PENDING intake copy when durable `head` is a command in
`pending` state: wire-frozen proposal id/name/coordinates plus §4「意图已接收，未完成」语义。Terminal receipt and canonical
winner lines stay separate (`succeeded`/`rejected` receipt hidden; winner may still tag `pending`). Stale-actor,
unavailable and incomplete evidence withhold the display. No automatic Continue/Submit, no main-city navigation, no
playable-first-city claims.
