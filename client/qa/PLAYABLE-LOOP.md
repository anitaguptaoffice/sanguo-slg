# Playable loop browser acceptance

`playableLoop.browser.mjs` is the real-browser acceptance for one fresh account: city/resources → hall upgrade → troop/hero recruit → march → battle report → reload → gateway restart. It drives real Chromium, Vite and the Go gateway; no mocks, never resets data. Use a disposable freshly initialized stack, never the shared QA demo DB.

Provisioning is documented fixture setup, not UI coverage: before the loop the real gateway RPC registers `demo` and, with `--city-x/--city-y`, creates one city at those coordinates; `result.json.provisioning` records the method and account/player/city IDs. An existing `demo` account is refused. All gameplay is UI-driven; RPC only corroborates state. UI registration, coordinate selection and automatic first-login provisioning are not verified.

## Run

    node client/qa/playableLoop.browser.mjs --restart-cmd '<restart the gateway>' \
      --city-x 6 --city-y 6 --out /tmp/opencode/playable-loop

`--exploratory` records blocked steps without claiming acceptance (exit 0). `--help` lists options.

## Assertions and evidence

Steps: `fresh-account`, `enter-city`, `hall-upgrade`, `recruit-troops`, `recruit-hero`, `battle`, `reload-persistence`, `g3-recruit-restart`, `g3-march-restart`, `stable-state-restart`, `runtime-errors`.

`reload-persistence` snapshots before/after and compares identity, city/hall (level + upgrade finish), hero/report IDs, wallet, troops, recruit queues and marches. Wallet growth may only come from `production_rates` and elapsed time (one second of production + 2 units); any decrease fails. Each restart snapshots before/after too; `stable-state-restart` compares identity, city, hall and hero IDs, wallet and returned march history, and asserts no battle-report or settled-troop loss, so a stable loss fails separately even while G3 fails. G3 owns the in-flight queue and active march order/ETA.

Only documented transient disconnects during the restart window (WebSocket close/refused/reset/empty response; HTTP 502/503) move to `restart_induced`; every other console/page/HTTP error goes to `errors` and fails acceptance. Both lists and the rule are in `result.json` and `runtime-errors`.

`--out` receives `result.json`, per-step screenshots, `browser.log` and `network.log`. Exit: `0` pass/exploratory, `1` failed/blocked, `2` usage/config, `3` internal. On current `main` the G3 steps are expected to fail acceptance; `--exploratory` records them as `blocked`. The stable-state step reports any separate loss it finds.
