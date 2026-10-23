# ART-BUILDINGS-002 — 四建筑联调样件

范围依据 [工程确认](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6365750518) 与 [ACK](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6365802093)。独立 Draft PR，不自动合并。

## 交付
- lumber/quarry/iron：逻辑 200×160，锚点 (100,160)，1×200×160 / 2×400×320。
- barracks：逻辑 220×180，锚点 (110,180)，1×220×180 / 2×440×360。
- ID为 `mc.building.{lumber,quarry,iron,barracks}.v1`；slot_key同名，原约定路径 `textures/{1x,2x}/maincity/<name>.png`。
- 八张 standalone RGBA PNG，共 968,731 字节；无 atlas/trim/crop_offset。现有 manifest 只追加四条，原六条字段/值全部保留，schema 不变。
- 不改运行时代码、玩法、协议、数值；官府/农田/背景/wall 不动。不得合并 #108/#100/#126/#77/#82。

## 来源与验证
四次内置 image_gen 原创生成，官府/农田仅作风格参考。三资源建筑原生 1402×1122，兵营 1388×1133，非伪造分层源文件。
完整原画布 contain 降采样至共同 canonical2×，再降采样1×；不放大、不按alpha裁切、不擦除微弱alpha。来源尺寸/哈希及输出尺寸/透明范围/哈希见 QA.json；提示词与来源 basename 见 generation-spec.json。本仓库不包含大原图或ZIP，来源路径仅为provenance标记。
八图实际解码/尺寸/RGBA/透明范围、SHA256、当前main schema验证通过；manifest原六条语义一致。contact-sheet-1x.png 为原像素尺寸静态浅/深/棋盘底审阅，不是游戏截图。

## 已知限制与待工程复验
- 画布底部安全边距2逻辑像素；保留原图微弱alpha后，主体可见底部（alpha>20）实际留白约5–7逻辑像素。不能保证完美贴地，不应静默trim或改锚点；如需清理先回本线程对齐。
- 静态1×审阅风格一致、无明显大面积色边；不代表最终艺术验收。铁矿细节最密；伐木场含风格化圆锯及工作台。
- **本批运行时未测试，最终验收 PENDING**。请工程验证四ID/路径可加载，DPR1/2倍率、四槽位落点/同屏比例、地面锚点/z-order、点击hit与透明边；提供截图与结论。
- 请跑 npm test / npm run build，并检查dist不包含reference/源稿。美术样件通过不代表完整图集管线通过。
