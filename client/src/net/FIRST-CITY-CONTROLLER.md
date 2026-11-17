# Dormant first-city controller

CLIENT-FIRST-CITY-CONTROLLER-001 ([#2537](https://github.com/anitaguptaoffice/sanguo-slg/issues/2537)) wires
`requestPersistedFirstCity`, journal history and `reduceFirstCityKnowledge` through `FirstCityController`.
Callers must still choose explicit proposals, command UUIDs, Continue and UI gates themselves.
`discover`, `submit`, `continueCommand` and `getResult` only synchronize retained knowledge after each persisted round trip.
`refresh` re-reads journal evidence without network I/O.
`head=null`, `incomplete` or `unavailable` never authorize gameplay, city entry or v1 `createCity`.
No `ServerSelectScene` changes, no automatic retries and no world.v2 server activation on main.
Official storage QA (#2506) and knowledge reducer (#2529) remain separate review gates.
