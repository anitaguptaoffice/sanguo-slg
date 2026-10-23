# 组合场景 VERIFY — 工程自检（非艺术终验）

## 声明

| 项 | 说明 |
|---|---|
| 目的 | **组合场景终验**证据；背景淡接缝等须在整景中由美术复查 |
| 全局 PASS | **无** — 后墙 / 四建筑 / HUD 等专项 PASS 不得 rollup |
| 合并 | **禁止**合并本 PR 及 hold 列表 #100 #108 #126 #140 #141 #144 #145 #153 #155 #77 #82 |

## 资源清单

- 稳定 ID：**14**（`manifest.json` `assets[]`）
- PNG 路径：**34**（含 `ui.button.primary.v1` 四态 × 1×/2× = 8 路径）
- 明细：`INVENTORY.json`（路径、scale、SHA256、来源 PR/commit）

## 工程自检

| 项 | 结论 |
|---|---|
| manifest 路径存在 | 见 `INVENTORY.json` → `integrity.pass` |
| DPR1 → `art 1× @1.0dpr` | 截图 HUD 标签 |
| DPR2 → `art 2× @2.0dpr` | 截图 HUD 标签 |
| `applyLayoutTransform` → `transform()` | 与 #145/#141/#155 一致 |
| HUD 四图标 canvas 行 + DOM 右对齐 | 无粮木铁石 DOM 叠字 |
| 七槽 + 背景按 stable ID 加载 | 运行时主城场景 |
| `npm test` / `npm run build` | PR CI |

## 发布包排除（dist）

`verify-art-full-scene-inventory.mjs` 检查 `client/dist` **不得**包含：

- `docs/art/samples` 下 QA/截图树
- `reference/` 原版参照
- 静态 `preview.png`、contact-sheet、VERIFY 截图目录

当前生产 `dist` 仅 Vite 打包产物 + `public/assets/art/v1` 运行时纹理。

## 美术待办（组合场景）

- [ ] DPR1/DPR2 全景可读图（JPG/WebP &lt;1MB）
- [ ] 背景跨块淡接缝整景观感
- [ ] 全场景 z-order / 叠层（非四建筑专项裁切范围）
