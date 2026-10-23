# ART-BUILDINGS-002 工程集成验证（verify/ART-BUILDINGS-002）

基于 `main` + cherry-pick `5a2d3ef`（#140 资产提交），**未合并** #140 / #108 / #100 / #126 / #77 / #82。

## 客户端修复（本验证分支）

- `MainCityScene.drawSlot`：对无显式 `asset_id` 的槽位也按 `mc.building.<slot_key>.v1` 加载 manifest 贴图（否则四槽仅显示占位色块）。

## 检查清单

| 项 | 结果 | 说明 |
|---|---|---|
| 四槽加载与摆放、与 slot display 同屏缩放 | **PASS** | 伐木/采石/铁矿 200×160，兵营 220×180；见截图 |
| DPR1 / DPR2 资源选择 | **PASS** | HUD：`art 1× @1.0dpr` / `art 2× @2.0dpr` |
| 地面锚点与 z-order | **PASS** | manifest anchor 与 `mainCitySlots` ground_anchor 一致；未改锚点/裁剪 |
| 点击热区与透明边 | **PASS（目视）** | 伐木场 hit 框点选正常；底部留白与 QA 5–7px 一致；低 alpha 浮点保留 |

## 截图（本分支）

- `docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1600x900-dpr1.png`
- `docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1600x900-dpr2.png`
- `docs/art/samples/art-buildings-002/screenshots/maincity-four-slots-1280x720-dpr1.png`
- `docs/art/samples/art-buildings-002/screenshots/hit-test-lumber-selected.png`

## npm

- `npm test`：24 passed
- `npm run build`：成功；`dist/` 含四建筑 PNG，**不含** `docs/art/samples` 草稿/contact-sheet

## 待跟进

- 城墙 `wall` 仍无 manifest 贴图（占位块，非本卡范围）
- 工程/美术最终签收：**PENDING**（本 PR 仅验证，勿合并艺术板 PR）
