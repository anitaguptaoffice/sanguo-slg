# ART-BUILDINGS-002 工程集成验证（verify/ART-BUILDINGS-002）

基于 `main`（rebase 后）+ cherry-pick `5a2d3ef`（#140 资产提交）。**未合并** #140 / #141 / #108 / #100 / #126 / #144 / #145 / #153 / #155 / #77 / #82。

## DPR 布局（自 VERIFY #145 `e3a204ef` / #155 口径移植）

- `applyLayoutTransform` 使用 `transform()` 叠乘 `GameApp` 的 DPR `scale`，避免 `setTransform` 清掉 DPR 导致 DPR2 舞台缩成 1/4。
- 单测：`client/src/engine/layoutViewport.test.ts`（`applyLayoutTransform` 与 DPR 叠乘）。

## 客户端加载

- 四槽 `lumber` / `quarry` / `iron` / `barracks`：`mc.building.<slot_key>.v1`（manifest + 1×/2× PNG，与 #140 资产一致）。
- `MainCityScene.drawSlot`：与 `main` 上 #142 行为一致（隐式 `slot_key` 加载）。

## 视口与裁剪

| 项 | DPR1 | DPR2 |
|---|---|---|
| CSS viewport | 1600×900 | 1600×900 |
| Canvas backing | 1600×900 | 3200×1800 |
| Playwright `deviceScaleFactor` | 1 | 2 |

四建筑区域裁剪（**DPR1/DPR2 相同 layout/CSS 矩形**）见 `viewport-metadata.json`：

- `fourBuildingsCropLayout`：`{ x: 240, y: 300, width: 1200, height: 420 }`（layout 1600×900）
- `fourBuildingsCropCss`：在 1600×900 全帧下与 layout 坐标一致（document 坐标）

## 检查清单

| 项 | 结果 | 说明 |
|---|---|---|
| 四槽加载与摆放、与 slot display 同屏缩放 | **PASS（工程）** | 伐木/采石/铁矿 200×160，兵营 220×180 |
| DPR1 / DPR2 资源选择与舞台缩放 | **PASS（工程）** | HUD：`art 1× @1.0dpr` / `art 2× @2.0dpr`；backing 见上表 |
| 地面锚点与 z-order | **PASS（工程）** | manifest anchor 与 `mainCitySlots`；未改锚点/像素 |
| 点击热区（伐木场） | **PASS（工程目视）** | `hit-test-lumber-selected.png` |
| 美术有限验收（四建筑 DPR1/DPR2 裁剪） | **PENDING** | 本 PR 仅工程证据；非城墙/HUD/全场景签收 |

## 截图证据（`evidenceCommitSha` 见 `viewport-metadata.json`）

原始 PNG（保留）：

- `screenshots/maincity-four-slots-1600x900-dpr1.png`
- `screenshots/maincity-four-slots-1600x900-dpr2.png`
- `screenshots/maincity-four-slots-1280x720-dpr1.png`
- `screenshots/hit-test-lumber-selected.png`

美术连接器友好（&lt;1MB JPG/WebP，同 layout 裁剪）：

- `screenshots/maincity-four-slots-1600x900-dpr1-full.jpg` / `-full.webp`
- `screenshots/maincity-four-slots-1600x900-dpr2-full.jpg` / `-full.webp`
- `screenshots/maincity-four-slots-1600x900-dpr1-four-buildings-crop.jpg` / `.webp`
- `screenshots/maincity-four-slots-1600x900-dpr2-four-buildings-crop.jpg` / `.webp`

固定 commit raw 链接（`evidenceCommitSha` = `665b20fa85aeb7d6270713e8b2a64bd6d64686ce`）：

- https://github.com/anitaguptaoffice/sanguo-slg/raw/665b20fa85aeb7d6270713e8b2a64bd6d64686ce/docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1600x900-dpr1-four-buildings-crop.jpg
- https://github.com/anitaguptaoffice/sanguo-slg/raw/665b20fa85aeb7d6270713e8b2a64bd6d64686ce/docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1600x900-dpr2-four-buildings-crop.jpg
- https://github.com/anitaguptaoffice/sanguo-slg/raw/665b20fa85aeb7d6270713e8b2a64bd6d64686ce/docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1600x900-dpr2-full.jpg
- https://github.com/anitaguptaoffice/sanguo-slg/raw/665b20fa85aeb7d6270713e8b2a64bd6d64686ce/docs/art/samples/art-buildings-002/viewport-metadata.json

## npm

```bash
cd client && npm test && npm run build
node scripts/capture-art-buildings-002-verify.mjs   # 需 playwright + chromium
```

- `npm test`：39 passed（含 layoutViewport DPR 叠乘单测）
- `npm run build`：成功；`dist/` 含四建筑 PNG，**不含** `docs/art/samples` 草稿

## 范围外

- 城墙 `wall`、全场景、后墙 #155 已关闭项：非本 VERIFY 签收范围。
