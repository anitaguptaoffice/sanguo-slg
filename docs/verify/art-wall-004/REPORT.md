# ART-WALL-004 工程联调 VERIFY（勿合并）

- 美术来源：`feat/ART-WALL-004-rear-wall` @ `0d9ea5bc54fb6e61a7df84247d302e435db838f5`（#153，未合入）
- 工程改动：cherry-pick 墙 PNG + manifest 增量；`mainCitySlots` 为 `wall` 槽挂 `asset_id` 以走 `drawSlot` 贴图路径
- **引擎终验 / 艺术终验：PENDING**（本报告仅记录运行时联调观测）
- **HUD/DPR 布局问题不在本 VERIFY 范围**，不据此标整体 PASS

## 验收清单

| 项 | 结论 | 说明 |
|---|---|---|
| DPR1 选 1× wall.png | PASS | `pickScaleVariant` @ DPR=1 → `textures/1x/maincity/wall.png`；解码 640×120 |
| DPR2 选 2× wall.png | PASS | @ DPR≥1.5 → `textures/2x/maincity/wall.png`；解码 1280×240 |
| display / anchor / 布局 | PASS | display 640×120、anchor(320,120)、槽位 (480,200) 与 manifest + `MAIN_CITY_SLOTS` 一致 |
| z=10 后景 | PASS | 绘制序按 z 升序，墙先于 z≥20 建筑；官府 z=30 叠在墙前 |
| hit 640×140 | PASS | 槽位 hit 与约定一致；高 z 槽重叠区点击优先（按 z 降序取 top） |
| QA 右端触边 | 观测 | 与 `docs/art/samples/art-wall-004/QA.json` 一致：输出 alpha 可触水平边界，不承诺源外延伸；未改 ID/尺寸/锚点 |

截图见同目录 `dpr1-wall.png`、`dpr2-wall.png`、`z-hit-hall.png`（VERIFY 分支 raw 链接见 Draft PR 正文）。
