# CLIENT-REPAIR-005 · center panel foreground (#1727)

Base: d3f1e7f (startup/build, narrow hero access, panel-state mount, safe int64 UI boundary).

- All content/military/building root opens and toggles use a shared **explicit** presentation boundary, scoped to sibling roots in their existing mount. No MutationObserver, global CSS override, or capture-script hiding.
- Switching suspends only the prior surface; DOM, selection and scroll remain. Existing caller-specific scroll/reset rules remain. Bag/shop record pre-switch context, preserve category scroll and return highlighting, and invalidate suspended refresh generations.
- Old keyboard traps suspend without restoring focus over the new target. New foreground focuses after synchronous render; Escape closes it. Dialogs/tooltips are not peer surfaces.
- A pending march RPC still updates data/highlights, but its completion cannot reopen military intelligence after newer navigation (including away and back). Late hero refresh cannot activate a hidden trap.

Validation: `npm test`; `npm run build`; `PLAYWRIGHT_BROWSERS_PATH=/tmp/sanguo-playwright node scripts/verify-center-panel-switching.mjs <evidence-dir>`.
Browser evidence is **production UI with mock Gateway transport**, not real-backend acceptance. Native toolbar paths cover mail→hero, queue→march, world→bag→shop→bag; native HUD mail-attachment deep link, keyboard Enter/Escape, delayed hero RPC and march refresh button at 1280×720 and 1600×900. No asset or schema changes.

Separate observed defect (not fixed here): at 1280×720 the idle city slot-strip rebuild loses focused button within 100 ms (strip intentionally hidden at 1600×900) (#1728). Existing pale secondary labels/engineering prose are also outside this lifecycle repair. Prior character art acceptance is unchanged.

Verified: 481/481 test files, 2277/2277 tests; strict TypeScript + Vite build PASS. Final sequential browser run passed both viewports with no page errors (workspace TMPDIR). An earlier parallel Chromium run crashed; no application workaround was added.
