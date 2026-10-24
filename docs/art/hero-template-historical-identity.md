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

## Slice 2（冻结 — Batch 1 第二批）

与 PR #108 联合冻结（美术 comment 6386161474、工程 comment 6386170338）及 main 上身份数据（#1021 squash `5772e512`）一致：`heroes.yml` / seed 已写入 `name` 与 `base_stats.historical_identity`。肖像 **8 个 asset 条目 / 16 张 PNG**（avatar + bust × 1×/2×）待美术交付；**不含** 1009–1012 等旧八人扩批口径。

| template_cfg_id | code | 展示名 / `historical_identity` | 状态 |
|---:|---|---|---|
| 1005 | `sun_archer` | **黄忠** | **冻结** |
| 1006 | `wind_cavalry` | **马超** | **冻结** |
| 1007 | `jade_strategist` | **诸葛亮** | **冻结** |
| 1008 | `fire_general` | **周瑜** | **冻结** |

## Slice 3（冻结 — Batch 1 第三批，1009–1040）

与 PR #108 联合冻结（工程 comment [6387652485](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6387652485)）一致：沿用 Slice 2 模式，`heroes.yml` → `generate_seeds.py` → `cfg_hero_template.sql`，并同步 `internal/hero/seed/heroes.json` 与客户端 `heroTemplateLabel` / mock 元数据。`template_code` 与 `template_cfg_id` **不变**；仅更新 `name` 与 `base_stats.historical_identity`。肖像 PNG **不在本卡**。

| template_cfg_id | code | 展示名 / `historical_identity` | 状态 |
|---:|---|---|---|
| 1009 | `north_wall` | **曹操** | **冻结** |
| 1010 | `river_sage` | **孙权** | **冻结** |
| 1011 | `stone_fort` | **吕布** | **冻结** |
| 1012 | `dawn_marshal` | **司马懿** | **冻结** |
| 1013 | `ink_advisor` | **张辽** | **冻结** |
| 1014 | `bamboo_guard` | **陆逊** | **冻结** |
| 1015 | `frost_blade` | **曹仁** | **冻结** |
| 1016 | `gold_envoy` | **典韦** | **冻结** |
| 1017 | `crane_healer` | **许褚** | **冻结** |
| 1018 | `bronze_smith` | **荀彧** | **冻结** |
| 1019 | `reed_scout` | **庞统** | **冻结** |
| 1020 | `plum_hermit` | **甘宁** | **冻结** |
| 1021 | `azure_phalanx` | **鲁肃** | **冻结** |
| 1022 | `ember_duelist` | **黄盖** | **冻结** |
| 1023 | `mist_ranger` | **魏延** | **冻结** |
| 1024 | `coral_admiral` | **姜维** | **冻结** |
| 1025 | `sand_pillar` | **华佗** | **冻结** |
| 1026 | `iron_bard` | **蒋琬** | **冻结** |
| 1027 | `lotus_healer` | **太史慈** | **冻结** |
| 1028 | `copper_quarter` | **吕蒙** | **冻结** |
| 1029 | `jade_sentinel` | **夏侯惇** | **冻结** |
| 1030 | `storm_lancer` | **夏侯渊** | **冻结** |
| 1031 | `pine_sage` | **张郃** | **冻结** |
| 1032 | `reed_admiral` | **徐晃** | **冻结** |
| 1033 | `granite_warden` | **郭嘉** | **冻结** |
| 1034 | `silk_diplomat` | **贾诩** | **冻结** |
| 1035 | `amber_alchemist` | **法正** | **冻结** |
| 1036 | `obsidian_scout` | **徐庶** | **冻结** |
| 1037 | `harbor_master` | **邓艾** | **冻结** |
| 1038 | `field_engineer` | **孙策** | **冻结** |
| 1039 | `dawn_archer` | **孙坚** | **冻结** |
| 1040 | `night_captain` | **貂蝉** | **冻结** |

**1040 例外**：貂蝉为《三国演义》等演义体系人物，**非**正史可考单一人名；`name` / `historical_identity` 仍填 **貂蝉**，供 UI 与美术绘制，文档与评审按**文学人物**口径处理（与史实武将表区分）。

## 变更记录

| 日期 | 说明 |
|---|---|
| 2026-10-24 | HERO-HIST-NAME-001：冻结 1001–1004 为刘备/关羽/张飞/赵云；补充 1009+ 草案表 |
| 2026-10-24 | Slice 2 联合冻结（#108）：1005–1008 冻结为黄忠/马超/诸葛亮/周瑜；与 seed 对齐；1009–1040 仍为草案 |
| 2026-10-25 | Slice 3 联合冻结（#108 comment 6387652485）：1009–1040 写入 `heroes.yml` / seed / SQL；1040 貂蝉标注演义人物例外 |
