# 将领模板 → 史实人物（美术绘制口径）

联结键：`cfg_hero_template.template_cfg_id`（DATA-002，`heroes.yml` 顺序自 **1001** 递增）。`code` 保持稳定，**不重命名**。

| 字段 | 位置 | 用途 |
|---|---|---|
| `name` | YAML / SQL `name` 列 | 玩家与 UI 展示名 |
| `base_stats.historical_identity` | JSON 内 | 与 `name` 对齐的史实身份；美术按此绘制肖像 |
| `base_stats.tagline` | JSON 内 | 游戏内简介（文案重写，非 legacy 拷贝） |

完整肖像交付规范见 [hero-avatar-bust-batch.md](./hero-avatar-bust-batch.md)。

## Slice 1（冻结 — Batch 1 首批必交）

与 `heroTemplateLabel` 冒烟子集、招募默认 `template_cfg_id=1001`、INTG 固定 id 一致。

| template_cfg_id | code | 展示名 / `historical_identity` | 状态 |
|---:|---|---|---|
| 1001 | `xuan_de_lord` | **刘备** | **冻结** |
| 1002 | `green_dragon` | **关羽** | **冻结** |
| 1003 | `thunder_spear` | **张飞** | **冻结** |
| 1004 | `silver_rider` | **赵云** | **冻结** |

**参照核对**：原版 `cfg_npc_hero` 为全量武将表（按 `npcid` 排序），与 DATA-002 模板顺序**无直接一一对应**；Slice 1 以本项目 `heroes.yml` 风味文案与 `internal/hero/catalog_embed.go` 遗留兜底名（刘备/关羽/张飞/赵云）对齐。客户端曾将 1004 占位标为「诸葛亮」，与银甲/七进七出风味及兜底目录冲突，本卡以 **赵云** 为准。

## 1005–1040（草案 — 待编排确认）

以下根据当前风味名与 `legacyDefaultCatalog()` 前 6 项等线索做的 **best-effort** 映射，**未写入** `heroes.yml` 的 `name` / `historical_identity`；美术勿按此批量开工，仅供后续 DATA/编排卡参考。

| id | code | 当前风味 `name` | 草案史实人物 | 依据（简述） |
|---:|---|---|---|---|
| 1005 | `sun_archer` | 落日神弓 | 黄忠 | 百步穿杨 |
| 1006 | `wind_cavalry` | 疾风铁骑 | 马超 | 西凉铁骑 |
| 1007 | `jade_strategist` | 碧玉谋臣 | 诸葛亮 | 运筹帷幄 |
| 1008 | `fire_general` | 赤焰都督 | 周瑜 | 火烧连营 |
| 1009 | `north_wall` | 北境柱石 | 张辽 | 固守边塞（待核） |
| 1010 | `river_sage` | 江左智囊 | 陆逊 | 江左、以弱胜强（待核） |
| 1011 | `stone_fort` | 坚城守御 | 曹仁 | 坚城（待核） |
| 1012 | `dawn_marshal` | 破晓元帅 | 孙权 | 统御三军（待核） |
| 1013 | `ink_advisor` | 墨香学士 | 荀彧 | 典章教化（待核） |
| 1014 | `bamboo_guard` | 青竹卫尉 | 典韦 | 护卫宫阙（待核） |
| 1015 | `frost_blade` | 寒霜剑侍 | 许褚 | 近卫剑士（待核） |
| 1016 | `gold_envoy` | 金印使节 | 蒋琬 | 游说盟约（待核） |
| 1017 | `crane_healer` | 白鹤医官 | 华佗 | 疗伤济世（待核） |
| 1018 | `bronze_smith` | 青铜匠师 | — | 泛化职司，无单一人物 |
| 1019 | `reed_scout` | 芦荡斥候 | — | 泛化职司 |
| 1020 | `plum_hermit` | 梅岭隐士 | 庞统 | 隐士奇策（待核） |
| 1021 | `azure_phalanx` | 青岚方阵 | — | 泛化阵型 |
| 1022 | `ember_duelist` | 烬锋斗士 | — | 待核 |
| 1023 | `mist_ranger` | 雾林游侠 | — | 待核 |
| 1024 | `coral_admiral` | 珊瑚水师 | 甘宁 | 水师（待核） |
| 1025 | `sand_pillar` | 沙洲柱将 | — | 待核 |
| 1026 | `iron_bard` | 铁弦乐士 | — | 待核 |
| 1027 | `lotus_healer` | 莲塘医女 | — | 待核 |
| 1028 | `copper_quarter` | 铜衡督粮 | — | 待核 |
| 1029 | `jade_sentinel` | 玉门哨帅 | — | 待核 |
| 1030 | `storm_lancer` | 惊雷枪骑 | — | 待核 |
| 1031 | `pine_sage` | 松岭谋士 | — | 待核 |
| 1032 | `reed_admiral` | 苇泽舟帅 | — | 待核 |
| 1033 | `granite_warden` | 磐石戍将 | — | 待核 |
| 1034 | `silk_diplomat` | 锦帛行卿 | — | 待核 |
| 1035 | `amber_alchemist` | 琥珀丹师 | — | 待核 |
| 1036 | `obsidian_scout` | 玄羽探子 | — | 待核 |
| 1037 | `harbor_master` | 津渡监官 | — | 待核 |
| 1038 | `field_engineer` | 野营匠首 | — | 待核 |
| 1039 | `dawn_archer` | 晨曦弓监 | — | 待核 |
| 1040 | `night_captain` | 夜巡都尉 | — | 待核 |

## 变更记录

| 日期 | 说明 |
|---|---|
| 2026-10-24 | HERO-HIST-NAME-001：冻结 1001–1004 为刘备/关羽/张飞/赵云；补充 1005+ 草案表 |
