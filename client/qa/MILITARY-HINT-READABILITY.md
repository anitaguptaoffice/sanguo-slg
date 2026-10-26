# Military preview helper readability

Local orchestrator-assigned client-only repair of the pre-existing 10→6px/pale
military helper rows identified by the march-food disclosure review.

Only the existing residual preview and its ten spans receive 14px/1.5 typography,
normal tracking/weight and wrapping. Applied paper uses #3d2e1f/#8b3a18 inks.
Art-off/missing-art uses #e8dcc8/#e8b86a over an opaque #1a1410 readout, so
contrast does not depend on whatever canvas content is behind the panel.
`skinMilitaryPanel` marks the actual installed border-image fill, not the requested
art mode. No marker means fallback, including missing image/nine-slice metadata;
an existing fill remains paper if a later call skips skinning without removing it.
One trailing glyph of internal space contains CJK punctuation overhang in the
wider unskinned readout without clipping text or changing the panel/scroll host.
No text, formatter, formula, warning/validation condition, state, row, scroll host,
submit behavior or art asset is changed; food disclosure is a separate card.

Run `npm test -- --maxWorkers=2`, `npm run build`, then serially:
`QA_OUT=/tmp/military-readability node qa/militaryReadability.browser.mjs`.
The native Chromium fixture uses production MainCityScene military markup,
styles, skin and preview functions, not a live gateway, DB or full scene.
It checks art-on/off/missing-image/missing-metadata, ten retained rows,
low/exact/adequate food, troop shortage, blank/reset,
hide/reopen, 1280×720/1600×900, actual font scale, paper-image contrast >=4.5,
glyph containment, row overlap and scroll/keyboard/pointer submit reachability.
Review the first/last normal/warning screenshots at both sizes. The larger text
intentionally needs more vertical scrolling; repeated helper content is preserved.
This is not historical hero/art or native gameplay acceptance.
