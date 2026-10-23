# 美术管线（工程侧草案）

> **状态：DRAFT — 未冻结。** 由工程维护 schema 与目录约定；美术在互审后按 schema 填元数据，**不直接改** `client/public/assets/art/v1/schema/` 下的文件。

## 发布目录

运行时资源根路径（Vite `base` 默认为 `/`）：

`client/public/assets/art/v1/`

浏览器解析为 `/assets/art/v1/...`。

## 文档索引

| 文档 | 内容 |
|---|---|
| [layout-landscape.md](./layout-landscape.md) | 外框 1600×900、舞台 1600×788、缩放策略 |
| [maincity-slots.md](./maincity-slots.md) | 主城槽位 `slot_key` 与**全布局坐标**（y 已含 HUD，勿重复 +56） |
| [id-mapping.md](./id-mapping.md) | 旧占位 ID → 新稳定 `asset_id` |
| [../reference.md](../reference.md) | 原版参照（**禁止**合并 #77 / #82） |

## 开工顺序（与 PR #100 一致）

1. **以 PR #100 分支上已推送的提交为基准**（`cursor/art-pipeline-docs-cffb`），美术即可开工 **ART-SAMPLE-001** 六类样件；**不要求先合并 #100**。
2. 工程侧本 PR 保持 **Draft**，供评审与迭代；样件纹理可基于同一分支提后续 PR 或附在样件交付包中。
3. 样件验收 **≠** 完整美术管线通过：首批仅为**不裁切独立 PNG**、无图集；图集 / `crop_offset` 等协议补齐后再做管线级验收。
4. 六类样件全部 **1× + 2×**（按钮四态各 2× 一张）。
5. **暂缓至下一批**：军事面板（`military-panel`）皮肤；聊天 / 军团 / 排行专用 UI 仍不在本轮。

## 外框 vs 舞台 vs 背景出图

| 区域 | 尺寸 | 说明 |
|---|---|---|
| 布局外框 | 1600 × 900 | HUD + 舞台 + 底栏 DOM |
| 主城舞台 | 1600 × 788 | y ∈ [56, 844) |
| 背景素材 `mc.bg.plateau.v1` | **1600 × 788** | 按舞台像素出图，**不是** 16:9 整屏图 |
