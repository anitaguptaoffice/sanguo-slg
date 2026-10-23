# ART-WALL-004 — 单张后景墙样件

依据 [墙体契约](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6366352169) 与 [源框清理授权](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6366375896)（另见6366377676/6366380228）。仅单张后景墙，不拆前后段、不扩环城。

## 交付与不变项
`mc.building.wall.v1`，kind=sprite，slot_key=wall，display640×120，anchor(320,120) pixels。路径 `textures/{1x,2x}/maincity/wall.png`，640×120 /1280×240透明RGBA，共419,134字节。
布局上下文仍为(480,200,640,120)，z=10后景，hit=(480,200,640,140)；不是新增manifest字段。本PR仅追加1条metadata，保留main现有6条；不改schema/代码/锚点/ID/槽位。不atlas/runtime trim/crop_offset，不做非等比拉伸。
官府/农田/背景/四建筑/图标及其他现有资产不动；不带入#140/#144。

## 制作源框（非运行时裁切）
原生1983×793 RGBA；按批准框[0,200,1983,572]准备1983×372源框。仅排除框外139个alpha=1/255漂点，全部alpha>10（实际全部alpha≥2）保留；没有全图阈值化或抗锯齿清理。
alpha>16源bbox=(1,239,1983,532)，上下缓冲39/40px。源稿、被拒重构图保留在私有制作包；本Git不含原稿/大参考图/ZIP。来源文件名仅为记录。
等比缩小20/31，整数舍入1279×240，补右侧1px到1280×240；再降采样1×，不放大。详见QA及source-reframe-evidence.json的坐标/比例/数量/哈希。

## 已知边界与验收
主体源右端触及x=1983，输出alpha也可接触水平两端；没有进一步减少x范围，但不能保证生成源画外延伸完整。1×alpha>16范围(0,12,640,107)，2×(0,25,1279,214)，请实测落位观感。
PNG尺寸/RGBA/透明范围/输出与源SHA256、实际剔除139像素alpha上限1、当前main schema均核验通过。
contact-sheet-1x.png是实际像素大小浅/深/棋盘底静态图，不是游戏截图。**本批引擎/艺术终验PENDING**。
请工程复验DPR1/2实际画布及选图、display/hit、锚点、z10后景遮挡与高z建筑点击优先。HUD重叠/DPR2舞台问题属另一路运行时修正，本墙样件不代表其已通过。
不自动合并；不合并/cherry-pick #108/#100/#126/#140/#144/#145/#77/#82。
