# Playable loop browser acceptance

`playableLoop.browser.mjs` is the real-browser acceptance for one fresh account: city/resources → hall upgrade → troop/hero recruit → march → battle report → reload → gateway restart. It drives real Chromium, Vite and the Go gateway; no mocks, never resets data. Use a disposable freshly initialized stack, never the shared QA demo DB.

Provisioning is documented fixture setup, not UI coverage: before the loop the real gateway RPC registers `demo` and, with `--city-x/--city-y`, creates one city at those coordinates; `result.json.provisioning` records method and IDs. An existing `demo` account is refused. All gameplay is UI-driven; RPC only corroborates state.

## Run

    node client/qa/playableLoop.browser.mjs --restart-cmd '<restart the gateway>' --city-x 6 --city-y 6 --out /tmp/opencode/playable-loop

`--exploratory` records blocked steps without claiming acceptance (exit 0). `--help` lists options.
## Assertions and evidence
Steps: `fresh-account`, `enter-city`, `hall-upgrade`, `recruit-troops`, `recruit-hero`, `battle`, `reload-persistence`, `g3-recruit-restart`, `g3-march-restart`, `stable-state-restart`, `runtime-errors`.

Every snapshot re-logs in and re-reads `listPlayerCities`/`getCityState`, so measured identity (player/server/session/city/owner/coords) must equal the expected fixture and itself across reload/restart; copied constants never stand in for a live read. `reload-persistence` starts a real recruit first and requires a non-empty in-flight queue, then gates the observable effect after re-entry: stable identity/hall/hero/report facts match (troop count is excluded because the queued credit may land during re-entry), the wallet neither loses resources nor gains beyond production, and the queued count is credited exactly once within its ETA (a 3s settle window rejects duplicate credit) — the exact single-credit check and settle window own the troop effect. `g3-recruit-restart` gates the same single-credit effect across the gateway restart and, on failure, names `queue_id/finish_at_ms/troops_before/expected`. `stable-state-restart` separately fails hall/hero/report/wallet/settled-troop loss; G3 owns in-flight recruit effect and march ETA.

Recruit queue identity/status across reload/re-entry is not verified: the queue list is client-local (`QueuePanels.recruits`, populated only at recruit submit; no server hydration or queue read RPC), so an empty DOM queue after re-entry is not evidence of a lost order. `result.json` records the after-reload/after-restart DOM queues as observations plus `reload_persistence.queue_identity_observability` and `g3.recruit.queue_identity_observability`; the harness gates only the persisted effect (single credit, no duplicate debit).

Only restart-window disconnects scoped to the observed `gatewayWs` origin move to `restart_induced`: HTTP 502/503 on `/ws` or `/healthz`, and console/page errors whose text names that gateway host:port and matches refused/reset/empty-response/WS-close. Generic 502/503, generic net errors and any frontend/Vite asset error stay in `errors` and fail `runtime-errors`; the rule is recorded in `result.json`.

`--out` receives `result.json`, per-step screenshots, `browser.log` and `network.log`. Exit: `0` pass/exploratory, `1` failed/blocked, `2` usage/config, `3` internal. On current `main`, G3 fails (the recruit effect is never credited and the in-flight march is gone) and `stable-state-restart` reports troop loss after restart; `--exploratory` records those as `blocked`.
