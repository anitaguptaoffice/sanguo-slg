# ServerSelect stale-actor isolation

CLIENT-FIRST-CITY-STALE-ACTOR-001 ([#2687](https://github.com/anitaguptaoffice/sanguo-slg/issues/2687)) binds Discover output
to the login/server/generation/scope that produced it and fail-closes Submit / Continue / GetResult when the panel actor
drifts (account switch, generation change, or `commandId` not owned by retained knowledge). Loopback gating and inFlight rules
match the #2679 stack; no v1 `createCity`, no main-city navigation, no playable-first-city claims.
