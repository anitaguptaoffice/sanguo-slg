# CLIENT-REPAIR-006 — stable domestic seven-slot controls (#1728)

MainCityScene refreshes the domestic strip every idle frame. Rebuilding all buttons
lost keyboard focus and could detach a pointer target between down and up.
The strip now reconciles by slot key, preserves unchanged nodes and delegated
listeners, and updates only changed text/attributes/selection. External return-ring
classes and native disabled state are retained; only absent keys are removed.
Existing semantics remain: upgrading/idle slots are selectable navigation controls,
not disabled upgrade-submit buttons. The matrix currently has seven fixed keys.

Validation (base d3f1e7f4be0730a3c4493835217e2d968b51c00b):

- `npx vitest run src/ui/MainCityDomesticSlotStrip.test.ts --maxWorkers=2`
  covers 100 unchanged syncs, focus/scroll/ring identity, ETA/state/label updates,
  selection, disabled click suppression, listener uniqueness, removal/re-add, lifecycle.
- `npx vitest run --maxWorkers=2`: **481 files / 2275 tests PASS**.
- `npm run build` runs both strict TypeScript configs and production Vite build.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/sanguo-playwright node scripts/verify-stable-city-slots.mjs ../evidence`
  starts its own mock Gateway and Vite on ports 19186/16286 in the same process tree.
  Native mouse down, 500 ms of scene updates, mouse up activates once; Enter activates
  once more, focus and original node survive. Tested 1280×720 and 1600×720 letterbox.
  At 1600×900 the strip is intentionally hidden by existing layout CSS: only node
  stability is tested there, not impossible focus on a hidden button. No force clicks,
  CSS overrides, replacement DOM, or changed production test hooks.

Browser evidence is frontend integration with mock transport, not backend acceptance
or new art acceptance. No PNG, manifest, schema, gameplay, or server changes.
