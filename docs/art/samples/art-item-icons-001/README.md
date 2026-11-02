# ART-ITEM-ICONS-001 — 原创道具图标候选包

- 任务：https://github.com/anitaguptaoffice/sanguo-slg/issues/1966
- 来源：DATA-002 `spec/data/source/items.yml` / `spec/data/generated/cfg_item.sql`，ID 2001–2049；49 项映射已逐项核对。
- 原创：built-in imagegen 逐项生成，不包含原版参考资产或历史 hold 内容。
- 状态：新候选规格；不是已冻结宿主合同，不是游戏截图，不代表已接入或运行时验收通过。
- 风格：Q 版手绘 2.5D、青玉/古铜/暖金、左上光源、透明底、完整轮廓，无名字/数量/品质框。
- 1×：64×64 RGBA；2×：128×128 RGBA。两版分别从高分辨率源图缩小，不从1×放大。
- 导出：完整源画布等比缩至56/112，再居中放在64/128透明画布；不按alpha裁切，不改变色相，不重绘。
- 原图低alpha散点/边缘噪声保留在源包中；交付版周围至少4/8px透明留白。高分辨率源包独立，不进客户端发布目录。
- manifest：`pack=shared`、`kind=icon`、建议 ID `item.icon.<id>.v1`；严格沿用现有schema字段，不新增item_cfg_id字段。
- 工程依赖：独立约定宿主尺寸/键映射/降级行为后接入；保留当前背包文字列表，不隐式添加格子或新玩法。
- 禁止把本候选验收解释为世界瓦片/兵种动画/战斗特效已完成；这些仍缺帧、方向、格像素等独立设计合同。
- 无main直接推送、强制推送、历史hold合并或生产部署。

## 内容
- textures/1x/items：1×候选纹理。
- textures/2x/items：2×候选纹理。
- manifest.candidate.json：可校验的独立候选清单，不写入生产manifest。
- INVENTORY.csv：名称/文件/源图与输出SHA256。
- QA.json：尺寸、RGBA、透明边和schema等技术检查；视觉审阅与未验事项分别列明。
