# CLIENT-ART-INTG-001 联调 QA（工程侧）

分支：`cursor/client-art-intg-001-827c`  
资产提交：cherry-pick `54394ad`（PR #108，未合并）  
契约只读来源：PR #100 @ `645b488`（文档/schema 拷贝，未合并 #100）

## 已知限制（不计入通过）

- 2× `mc.bg.plateau.v1` 为 **UPSCALED PLACEHOLDER**，非原生 HD 验收。
- `preview.png` 为静态拼装，非运行时截图。
- 样件通过 ≠ 图集/裁切管线完成。

## 验证清单

| 项 | 结果 | 说明 |
|---|---|---|
| 外框 1600×900 / 舞台背景 1600×788 @ y=56 | PASS | `MainCityScene` 按 layout 绘制，y 未重复 +56 |
| 官府/农田 锚点、缩放、z-order | PASS | 槽位表 z=20/30；农田在官府之下 |
| 点击 hit（layout 坐标） | PASS | 逆序 z 命中；农田点击触发升级 |
| 按钮四态 `ui.button.primary.v1` | PASS | 主城工具栏 DOM 皮肤 |
| 面板九宫格 `ui.panel.default.v1` | PASS | 军事面板 border-image 24px 逻辑边 |
| DPR 1× / 2× 纹理选择 | PASS | `pickScaleVariant`；HUD 显示 `art 1×/2×` |
| `base_url` + Vite `BASE_URL` | PASS | `joinArtBaseUrl` 单测 |
| `npm test` | PASS | client vitest 16/16 |
| `npm run build` | PASS | dist ≈11MB 仅 `public/assets/art/v1` 纹理，无 `reference/`、无 `preview.png` |
| `make test` | N/A | 未改 server |

## 截图

- `docs/art/samples/art-sample-001/screenshots/maincity-1600x900-dpr1.png`
- `docs/art/samples/art-sample-001/screenshots/maincity-1280x720-dpr1.png`
- `docs/art/samples/art-sample-001/screenshots/maincity-1600x900-dpr2.png`

生成：`cd client && node scripts/capture-art-intg-screenshots.mjs`（mock gateway + dev）。

## 美术反馈（契约外问题，未改资源）

| 资源 ID | 复现步骤 | 截图 | 预期效果 |
|---|---|---|---|
| `mc.bg.plateau.v1`（2×） | DPR≥1.5 进入主城 | `maincity-1600x900-dpr2.png` | 需提供原生 3200×1576 背景；当前为放大占位 |
| `mc.building.hall.v1` / `mc.building.farm.v1` | 对比槽位表与精灵透明边 | 同上 | 源图 alpha 贴边，contain 后仍有 padding；若需贴地更紧需美术裁切规范（非工程静默改尺寸） |
| 其余槽位 | 进入主城 | 同上 | 无样件 PNG，仍为占位色块（符合样件范围） |
