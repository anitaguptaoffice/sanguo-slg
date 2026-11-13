# ServerSelect explicit V2 GetFirstCityResult

CLIENT-FIRST-CITY-RESULT-001 ([#2548](https://github.com/anitaguptaoffice/sanguo-slg/issues/2548)) adds an explicit
**GetResult** control beside the dormant Submit/Continue block on loopback ServerSelect only (`permitsFirstCityV2Probe`).
Users enter a `commandId` (prefilled from the latest durable head or local intent when available) and run
`FirstCityController.getResult` via `runFirstCityResultCommand` after `login` → `enterGameServer`.
Status text reflects retained knowledge: `NOT_OBSERVED`, `pending`, `succeeded`, and conflict arms without claiming
playable first-city completion, main-city navigation, or production backend activation.
No v1 `createCity`, no automatic routing, and `wss:` / remote `ws:` keep the probe hidden.
