# CLIENT-REPAIR-003 — panel state mounting and five-asset audit

Scope: #1714, engineering mounting only. No PNG, manifest, schema, server,
character acceptance or art-hold merge changes.

## Prerequisite and repair

Baseline main `e767d1b12efed49d826badd32d93cf20b0243f98` cannot boot without
CLIENT-REPAIR-002. Final local verification uses its
`4ae4bff428b9efaf6e759b91bcb56d008037ddae` plus this patch, not untouched main.

The three `ui.panel.{loading,empty,error}.v1` assets contain centered artwork
inside a nine-slice frame. Filling the center stretched that artwork into
horizontal marks on short list rows; inherited beige ink was unreadable on
cream. Use the existing frame without center fill and explicit dark state ink.
Live text remains the status indication. Reapplication clears owned styles;
attach generated rows before checking ancestor `data-art-skin=off`.

## Reproduce

From client, with dependencies and Playwright Chromium already installed:

```sh
npm run build
npx vitest run src/engine/panelStateChrome.test.ts src/engine/heroPanelArtMount.test.ts src/engine/panelGatewayError.test.ts src/engine/artWorldMinimapSkin.test.ts src/engine/artMinimapDestSkin.test.ts
OUT_DIR=/tmp/panel-qa node scripts/qa-panel-art-local.mjs
OUT_DIR=/tmp/minimap-qa node scripts/qa-minimap-art-local.mjs
```

Set `PLAYWRIGHT_BROWSERS_PATH` if using a nondefault browser cache. The scripts
launch their own local mock gateway (19301), Vite (16301), and headless Chromium.
GatewayClient responses are controlled to reach actual production UI states;
no DOM hiding or style replacement is used. Skin-off uses the supported data
attribute. Close previous panels through real toolbar actions before opening
another: toolbar panels are not mutually exclusive in this baseline.

## Results and limits

- Build passed; five focused test files: 29 tests passed.
- 1280×720 DPR1, 1600×900 DPR1, 1600×900 DPR2: mail loading/empty/error
  captured with readable text and undistorted frame. Real Refresh click changes
  error→loading→empty. Skin-off restores legacy dark row / beige text.
- March and queue empty states captured through their real hosts. Hero empty
  state has excessive pre-existing residual prose and is not a whole-panel PASS.
- `ui.minimap.dest.v1`: actual canvas screenshots cover selected/unselected,
  zoom/pan and skin-off fallback at all three viewports; marker remains recognizable.
- `ui.minimap.legend.v1`: present in manifest but not consumed by runtime.
  Current legend is canvas text. Therefore no runtime asset PASS for this ID.
- Mock QA is not live backend / full-playthrough acceptance. Unrelated mock RPCs
  can report unsupported route; they do not establish backend failures.
- Existing panel overlap, pale non-state labels, clipped nonempty march rows,
  and repeated hero residual prose are outside this bounded patch. Do not infer
  whole-application art or accessibility approval from the state-row result.

Local evidence (not published assets): `/tmp/sanguo-panel-art-before` baseline;
`/tmp/sanguo-panel-art-isolated` repaired states;
`/tmp/sanguo-minimap-art-base4ae` minimap. Full screenshots accompany cropped
state rows and computed-style JSON. Baseline screenshots predate CSS prerequisite
repair; do not attribute all layout differences to this patch.
