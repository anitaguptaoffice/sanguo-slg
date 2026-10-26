# CLT-RENDERER-LIFECYCLE-001 — Stable city slot-upgrade DOM

Scope: `client/**`; no gameplay, server, static resource or art asset changes.

## Defect and repair

`MainCityScene.update()` synchronizes idle slot overlays on each animation frame.
Previously every sync removed and rebuilt all seven tag subtrees, including unchanged
labels. This also discarded externally scheduled completion/highlight classes. The
new overlay keeps one tag per slot, changes text/progress only when needed, and
clears its keyed references on detach. Repeated attach is idempotent.

## Regression gates

- Repeated unchanged frames preserve node identity and create no DOM mutations.
- Upgrade countdown/progress, completion, missing building and level updates remain visible.
- Mutual highlight selection, external pulse classes, repeated attach/detach stay bounded.
- Focused command: `npm test -- src/ui/MainCitySlotUpgradeOverlay.test.ts src/net/mainCitySlotUpgrade.test.ts src/ui/MainCityDomesticSlotStrip.test.ts`.

## Runtime evidence boundary

The isolated diagnostic mounts actual GameApp/MainCityScene/CSS/assets using
recorded decoded RPC snapshots and ordinary five-second polls. It is not natural
acceptance and never changes the preserved original database. Renderer RSS, CDP
heap/DOM counters and AssetLoader image count distinguish allocation growth from
retained JS/DOM/image growth. The original crash cause is not inferred from one
clean run; repeated frozen controls and bounded candidate observation are required.

This card fixes independently reproduced DOM churn and highlight loss. It makes no
claim of native stability acceptance or a proven cause of previous page crashes;
those require the separate controlled and native observation evidence.
