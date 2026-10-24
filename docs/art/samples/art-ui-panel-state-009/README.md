# ART-UI-PANEL-STATE-009 client mount evidence

Engineering cherry-pick for **CLIENT-128** ([#532](https://github.com/anitaguptaoffice/sanguo-slg/issues/532)): **3** manifest id / **6** PNG (loading / empty / error nine-slice). Pattern [#482](https://github.com/anitaguptaoffice/sanguo-slg/pull/482) / [#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509). **Not merged**: art hold / VERIFY Drafts (#77 / #82 / #108 / #506 / …).

## Manifest

- See `manifest-index.json` and [INVENTORY.md](./INVENTORY.md)
- Helper: `client/src/engine/artPanelStateSkin.ts` (`resolvePanelStateAssetId`)
- Runtime wiring: **CLIENT-129** (`panelStateChrome`)

## 对照说明

| 面板态 | asset id | 用途 |
|---|---|---|
| loading | `ui.panel.loading.v1` | 首屏拉取骨架纸底 |
| empty | `ui.panel.empty.v1` | 列表/筛选空结果纸底 |
| error | `ui.panel.error.v1` | 网关/拉取错误纸底 |

文案与动效由代码绘制；图内无烘焙文字。`data-art-skin="off"` 时 CLIENT-129 回退 CLIENT-067 纯文案。

## Regenerate

`cd client && node scripts/capture-art-ui-panel-state-009-evidence.mjs`
