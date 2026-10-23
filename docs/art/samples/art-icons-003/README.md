# ART-ICONS-003 — 三资源 HUD 图标样件

依据 [工程规格确认](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6366054140) 与 [ACK](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6366097569)，仅 wood / iron / stone。

## 交付
- `res.icon.wood.v1` / `res.icon.iron.v1` / `res.icon.stone.v1`，kind=icon，display32×32，anchor(16,16) pixels。
- `textures/{1x,2x}/icons/{wood,iron,stone}.png`，1×32×32、2×64×64，六张透明RGBA PNG，共20,612字节。
- runtime manifest仅追加3条，保留main现有6条；不拉入尚未合并的#140四建筑，不改schema/运行时代码/玩法。粮食、建筑、背景、wall不动，不做币/战力。

## 导出和核验
三次内置image_gen原创图均1254×1254 RGBA。完整原画布LANCZOS contain至52×52，居中置于64×64透明画布（四边6px），再从canonical64降采样32。不放大、不trim/crop、不atlas、不重着色/锐化。
六张实际PNG尺寸、RGBA、SHA256和每一个外边框alpha=0核验通过；完整及增量manifest通过当前main schema，ID无冲突。QA记载确定性重导哈希一致。
原图alpha1–7微弱噪声触及部分画布边缘，仍保留整帧、不擦除；有意义主体(alpha≥8)内缩。原图/粮食参考/大源稿/ZIP不上传；QA来源路径及provenance文件名只作来源记录。

## 视觉与待工程联调
contact-sheet.png含32px/64px实际尺寸及已标识的3×nearest诊断图，在浅/深/棋盘背景并列已批准粮食。静态小尺寸识别性通过，不是游戏截图或最终艺术验收。
**本批运行时未测试，工程/艺术终验PENDING。** 请工程验证三HUD资源图标加载、DPR1/2选图、32px识别性/视觉重量/透明边、与food并列一致性，跑npm test/build与dist源文件排除并回#108截图结论。
独立Draft PR，不自动合并，不合并/cherry-pick #108/#100/#126/#140/#77/#82。
