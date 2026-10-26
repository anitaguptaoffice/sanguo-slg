# CLT-LAYOUT-IDEMPOTENT-001 — Idempotent frame layout writes

Scope: `client/**`; separate from slot-overlay lifecycle repair and crash attribution.

`GameApp` checks layout on every animation frame and through ResizeObserver.
Writing the unchanged `--ui-scale` custom property causes redundant Chromium style
recalculation. `applyLayoutFrameStyles` now compares actual inline values before
writing. It does not cache away or remove the existing resize/DPR checks.

Regression tests prove 600 unchanged calls make no scale writes or DOM mutations;
changed size, letterbox offsets, scale, external inline-style repair, ResizeObserver,
animation-frame DPR changes and narrow-mode transitions still work.

Commands: `npm test -- src/engine/layoutFrameStyles.stability.test.ts src/engine/layoutViewport.test.ts`;
then `npm test` and `npm run build` for the aggregate candidate.

Frozen diagnostic ablation (both overlay sync and repeated canvas-size sync disabled)
reduces style recalculation to poll-driven work. This does not itself identify the
native page-crash cause or prove a retained-memory leak. Runtime comparison and
long native private-copy observation are recorded with the renderer diagnostic.
