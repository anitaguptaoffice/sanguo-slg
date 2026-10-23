# ART-WALL-004 工程联调 VERIFY（勿合并）

- 美术来源：`feat/ART-WALL-004-rear-wall` @ `0d9ea5bc54fb6e61a7df84247d302e435db838f5`（#153，未合入）
- 工程改动：cherry-pick 墙 PNG + manifest 增量；`mainCitySlots` 为 `wall` 槽挂 `asset_id` 以走 `drawSlot` 贴图路径
- **DPR 布局**：自 VERIFY #145 `e3a204ef` 移植 `applyLayoutTransform` → `transform()` 与 GameApp DPR `scale` 叠乘（修复 DPR2 截图右半黑屏、与 DPR1 不同 CSS 裁切区的问题）；**未改墙 ID/尺寸/锚点/像素**
- **引擎终验 / 艺术终验：PENDING**（DPR1 墙视觉美术已记 PASS @ `c13716df`；DPR2 待美术在新证据下复验）
- 工程自检：DPR 裁切证据已按同一 CSS 区域重拍（见下表）

## 截图元数据（Playwright 1600×900 CSS viewport）

| 项 | DPR1 | DPR2 |
|---|---|---|
| `devicePixelRatio` / Playwright DSF | 1 | 2 |
| CSS viewport | 1600×900 | 1600×900 |
| Canvas backing store | 1600×900 | 3200×1800 |
| **墙裁切（CSS px，两档相同）** | x=400, y=40, w=800, h=320 | x=400, y=40, w=800, h=320 |

- 全舞台（布局帧 JPG，DPR1）：`full-stage-dpr1.jpg`（layout-frame 1600×900 CSS）
- DPR2 墙裁切（审阅可读，同 CSS 区，自 `dpr2-wall.png` 无损派生；**保留原 PNG**；**未改 `textures/*/maincity/wall.png`**）：`dpr2-wall.jpg`（≈232 KiB）、`dpr2-wall.webp`（≈176 KiB）
- 机器可读：`viewport-metadata.json`（含 `dpr2WallReviewArtifacts` 与 `evidenceCommitSha`）
- **审阅固定 SHA（`raw/<sha>/…` 直链）**：`5da849285a788a83a44be4cd93ba66cc5891de67`（含 PNG/JPG/WebP 与 `viewport-metadata.json`）
- **压缩图入树提交**：`89eb6460066bc983199a83d411f577bcb99cade3`（见 `viewport-metadata.json` → `evidenceCommitSha`）
- 布局/DPR 修复首版截图仍见于 `cf6c8262a3882ce5b73a2b8386e0d697847a2b59`；DPR2 墙专项请以固定 SHA 下 JPG/WebP 复验

## 验收清单

| 项 | 结论 | 说明 |
|---|---|---|
| DPR1 选 1× wall.png | PASS | `pickScaleVariant` @ DPR=1 → `textures/1x/maincity/wall.png`；解码 640×120 |
| DPR2 选 2× wall.png | PASS | @ DPR≥1.5 → `textures/2x/maincity/wall.png`；解码 1280×240 |
| DPR1 墙视觉（美术） | PASS（记录） | #108 @ `c13716df`；**非整体终验** |
| DPR2 墙视觉（美术） | **PENDING** | 已补 `<1MB` 的 `dpr2-wall.jpg` / `dpr2-wall.webp`（同 CSS 裁切）；待美术复验 |
| display / anchor / 布局 | PASS | display 640×120、anchor(320,120)、槽位 (480,200) 与 manifest + `MAIN_CITY_SLOTS` 一致 |
| z=10 后景 | PASS | 绘制序按 z 升序，墙先于 z≥20 建筑；官府 z=30 叠在墙前 |
| hit 640×140 | PASS | 槽位 hit 与约定一致；高 z 槽重叠区点击优先（按 z 降序取 top） |
| QA 右端触边 | 观测 | 与 `docs/art/samples/art-wall-004/QA.json` 一致：输出 alpha 可触水平边界，不承诺源外延伸；未改 ID/尺寸/锚点 |

截图见同目录 `dpr1-wall.png`、`dpr2-wall.png`、`dpr2-wall.jpg`、`dpr2-wall.webp`、`z-hit-hall.png`、`full-stage-dpr1.jpg`（VERIFY 分支 `raw/<full-sha>/…` 链接见 Draft PR 正文）。

## 勿合并

#153 #155 #108 #100 #126 #140 #144 #145 #77 #82
