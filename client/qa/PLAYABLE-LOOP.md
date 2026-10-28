# Playable loop browser acceptance

`playableLoop.browser.mjs` is the repeatable real-browser acceptance for one fresh
account: city/resources → hall upgrade → troop/hero recruit → march → battle report
→ reload → gateway restart persistence, including the known G3 in-flight gap. It
drives the real Chromium, Vite frontend and Go gateway; there are no mocks, and it
never resets data. Use a disposable freshly initialized stack, never the shared QA
demo DB. The UI login is fixed to `demo`/`demo123`, so the script registers it and
refuses an existing account ("stack is not fresh").

## Run

    node client/qa/playableLoop.browser.mjs --restart-cmd '<restart the gateway>' \
      --city-x 6 --city-y 6 --out /tmp/opencode/playable-loop

`--exploratory` records blocked steps without claiming acceptance (exit 0).
`--city-x/--city-y` pre-create the city near the only seeded garrison at (5,5);
without it the fixed (60,60) spawn exceeds `--max-wait` and the battle step reports
the distance/ETA as blocked. `--help` lists every option.

## Assertions and evidence

Steps: `fresh-account`, `enter-city`, `hall-upgrade`, `recruit-troops`,
`recruit-hero`, `battle`, `reload-persistence`, `g3-recruit-restart`,
`g3-march-restart`, `runtime-errors`. The G3 steps fail acceptance when in-flight
recruits or marches are lost on restart and print queue/arrival times, garrison and
wallet. `--out` receives `result.json`, per-step screenshots, `browser.log` and
`network.log`. Exit: `0` pass/exploratory, `1` failed/blocked, `2` usage/config, `3` internal.
On current `main` the two G3 steps are expected to fail acceptance until in-memory
recruit/march state is persisted; `--exploratory` records them as `blocked` instead.
