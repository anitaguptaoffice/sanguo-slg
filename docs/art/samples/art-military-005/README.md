# ART-MILITARY-005 — 军事九宫格样件

冻结依据：[#108 生产契约](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6368969793)、[细节补充](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6368988906)。

唯一新增`ui.panel.military.v1`，kind=nine_slice，display320×200，anchor(0,0) pixels沿用已有面板约定，L/T/R/B=24逻辑px（2×切48物理px）。路径`textures/{1x,2x}/ui/panel_military.png`，320×200 /640×400 RGBA。
原创SVG分别96/192 DPI直接光栅化，无位图上采样。玉色/青铜边框与暖纸色中心，无文字、图标、内容、按钮或输入框烘焙；固定角饰不进入可拉伸区。切边内侧8px无装饰，纯色中心#F5ECD7。
仅manifest追加1条，保留main原14ID/34PNG，完成后15ID/36PNG。既有default与primary复用不抛光，不改schema/runtime/玩法/RPC/CancelMarch，不引入其他控件ID。

## 本地验证
尺寸/RGBA/透明角/源PNG哈希/纯色中心与当前main schema通过。制作QA报告可拉伸行列一致、四角不变；离线320×200、420×788、336×630、420×320的DPR1/2九宫格测试见QA。
review-montage.png是静态拼图，不是游戏截图；336×630测试不是1280×720视口实测。visual-review.json记录本地目视及哈希，引用的原路径仅为私有制作包provenance。
本Git候选包不包含原SVG或全部离线预览；生产纹理目录仅两张新PNG。文档预览位于docs，不进入public。

## 待工程验收
**运行时/最终艺术验收PENDING。** 请工程复验1600×900 DPR1/2军事打开态、1280×720可读性、细长右侧面板九宫格、复用按钮状态与关闭后不挡主城。DOM padding12×16属于工程接线约定，美术静态QA不证明内容布局或hit。
中心队列/邮件/日常/背包复用旧像素，不因此自动通过视觉验收。此包作为独立Draft交接候选；不得自动合并。
