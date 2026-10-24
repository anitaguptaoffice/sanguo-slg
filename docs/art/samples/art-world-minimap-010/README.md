# ART-WORLD-MINIMAP-010 client mount evidence

Engineering cherry-pick for **CLIENT-138** ([#558](https://github.com/anitaguptaoffice/sanguo-slg/issues/558)): **2** manifest id / **4** PNG（行军目的点 marker + 图例条 chrome）。Pattern [#482](https://github.com/anitaguptaoffice/sanguo-slg/pull/482) / [#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509) / [#551](https://github.com/anitaguptaoffice/sanguo-slg/pull/551)。**Not merged**: art hold / VERIFY Drafts (#77 / #82 / #108 / #506 / …)。

## Manifest

- See `manifest-index.json` and [INVENTORY.md](./INVENTORY.md)
- Helper: `client/src/engine/artWorldMinimapSkin.ts` (`resolveMinimapDestAssetId` / `resolveMinimapLegendAssetId`)
- Runtime wiring: **CLIENT-139** (`drawWorldMinimap` sprite mount)

## 对照说明

| 元素 | asset id | 用途 |
|---|---|---|
| 目的格 marker | `ui.minimap.dest.v1` | 替换 canvas 圆点（默认 #c97b63；选中高亮由运行时 tint / 放大） |
| 图例条 chrome | `ui.minimap.legend.v1` | 标题行下 `MINIMAP_DEST_ETA_LEGEND` 文案前的纸底条；文案仍由代码绘制 |

不含世界瓦片/全屏图集。`data-art-skin="off"` 时 CLIENT-139 保留 canvas 回退。

## Regenerate

`cd client && node scripts/capture-art-world-minimap-010-evidence.mjs`
