# ART-UI-FILTER-008 client mount evidence

Art assets cherry-picked from Draft PR [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) @ `38451735` (**not merged**). Frozen contract reference PR **#108** (hold, not merged).

## Manifest

- **9** asset ids / **18** PNG (1× + 2×) — see `manifest-index.json`
- Main tree `client/public/assets/art/v1/manifest.json` total **46** entries after mount

## Runtime helper

`client/src/engine/artUiFilterSkin.ts` — `mountFilterUiSkins` wires:

| Piece | States | asset ids |
|---|---|---|
| Filter chip | normal / hover / pressed / selected | `ui.chip.filter.*.v1` |
| List row nine-slice | default / hover / selected | `ui.list.row*.v1` |
| Badge dot | — | `ui.badge.dot.v1` |
| Badge count (20×16, 1–9 / 9+) | — | `ui.badge.count.v1` |

`data-art-skin="off"` on chip/row/badge or an ancestor skips manifest chrome.

Chip **CSS hit wrap ≥44×44** while sprite stays **72×32** — see `hit-proof.json`.

## Regenerate

`cd client && node scripts/capture-art-ui-filter-008-evidence.mjs`

运行时全视口 + 探针（含 #578 日常行条与 chip `badge_count` 皮肤 crop）：

`cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs`

## Tests

`artUiFilterSkin.test.ts`; full suite `cd client && npm test`.
