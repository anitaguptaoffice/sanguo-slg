# 将领头像 + 半身像批量交付（ART-HERO-AVATAR-BUST-001）

> **状态：Slice 0–1 身份 + 宿主契约已冻结，**1001–1004** 像素已入库（8 asset / 16 PNG）；**Slice 2（1005–1008）** 身份 + 宿主契约已于 PR #108 联合冻结（美术 6386161474 / 工程 6386170338），美术可开绘，**像素尚未入库**。1009+ 仍为草案。工程 schema 槽位见下文；参照 PR #77 / #82 / #100 / #108 / #126 与 Draft art hold **只读**，禁止合并或把 legacy 美术复制进主树。

## 范围（Batch 1，固定）

| 包含 | 不含 |
|---|---|
| 列表 **avatar**（`cfg_hero_template` 级） | 全身立绘 / 大地图将领 pin |
| 详情 **bust**（同上模板 id） | 修改 `spec/proto`、DATA-003、`cfg_act*` |
| **1× + 2×** standalone PNG | 图集 / `crop_offset` 管线验收（沿用 ART-SAMPLE-001 暂缓口径） |

布局验收基准：**1600×900** 外框 + [layout-landscape.md](./layout-landscape.md) 舞台；**不以** 360×640 为通过标准。

## 真源：将领模板 ID

| 项 | 位置 |
|---|---|
| 行数上限 | [spec/data/CORE_SUBSET.md](../spec/data/CORE_SUBSET.md)（将领模板 ≤90） |
| 源 YAML | `spec/data/source/heroes.yml` |
| 生成 SQL | `spec/data/generated/cfg_hero_template.sql` |
| ID 规则 | `heroes[]` **顺序** → `template_cfg_id` **从 1001 递增**（见 [MAPPING.md](../spec/data/MAPPING.md)） |

当前 DATA-002 已灌入 **40** 个模板：**1001–1040**（与 `heroes.yml` / SQL 一致）。展示名以 `heroes.yml` 为准。

**Slice 1 史实身份**（1001–1004）已由 **HERO-HIST-NAME-001** 冻结并已交付纹理；**Slice 2**（1005–1008：黄忠 / 马超 / 诸葛亮 / 周瑜）身份已于 #108 联合冻结并与 seed（#1021 `5772e512`）对齐。美术按 [hero-template-historical-identity.md](./hero-template-historical-identity.md) 绘制 likeness。**1009+** 仍为风味展示名，史实名仅见该文档草案表。

运行时将领面板（`data-center-panel="hero"`）今日仍用 **纯文案** 列表/详情；`ui.panel.hero.v1` / `ui.icon.toolbar.hero.v1` 仅为 **面板九宫格与底栏图标**（见 [samples/art-center-panel-012](./samples/art-center-panel-012/README.md)）。本批交付 **不阻塞** 玩法；缺图时客户端 **保持现状**（无图、无报错）。

## 稳定 `asset_id` 命名

联结键：**`template_cfg_id`（整数）**，与玩家实例 `hero_id` 无关。

| 用途 | `asset_id` 模式 | 示例（1001 / `xuan_de_lord`） |
|---|---|---|
| 列表头像 | `hero.avatar.<template_cfg_id>.v1` | `hero.avatar.1001.v1` |
| 详情半身 | `hero.bust.<template_cfg_id>.v1` | `hero.bust.1001.v1` |

须满足 schema 中的 id 正则：`^[a-z0-9]+(\.[a-z0-9_-]+)+\.v[0-9]+$`。

可选 `tags`（推荐）：`hero-portrait-batch1`、`template_code:<code>`（如 `template_code:xuan_de_lord`），便于美术台账；**不得**用 tag 替代 `template_cfg_id` 字段。

## 逻辑尺寸 / 锚点 / 裁切期望

数值为 **1× 逻辑像素**（`display_size`）；2× PNG 为同构图 **2× 像素**，不改 `display_size`。

| kind | 逻辑框 `display_size` | 锚点 `anchor`（pixels） | 构图 |
|---|---|---|---|
| `hero_avatar` | **56 × 56** | **(28, 48)** 下颌/胸口中心偏下 | **圆形** 列表头像（见下）；发际线至下巴（不含冠）占框 **≥60%** 高度（**仅 1001** 允许 **≥57%** 特例，**不**延续至 1002+）；透明底；**不烘焙** 等级/稀有度/名字 |
| `hero_bust` | **128 × 160** | **(64, 152)** **定位锚点**（见下） | 头 + 肩胸；画幅顶 **≥12px**、底 **≥16px** 呼吸留白；左右肩裁切对称；透明底 |

### 工程契约澄清（裁剪 / 遮罩 / 锚点 / 倍率）

- **交付像素**：美术提交 **正方形** RGBA 透明 PNG（avatar 画布 56×56 / 112×112；bust 画布 128×160 / 256×320）。**圆形遮罩由工程侧**（`border-radius: 50%` 或 `clip-path: circle()`）应用；**禁止**在像素里烘焙圆形 alpha 遮罩。
- **列表 avatar 挂载**：`object-fit: cover`；`object-position: center`；逻辑框 **56×56**。
- **安全区**：脸/冠/须落在画幅中心约 **80%** 区域内；四周保留 **≥2px** 全透明边距，勿贴边裁切。
- **2× 来源**：必须为 **原生绘制/导出**（avatar **112×112**，bust **256×320**）；**禁止**从 1× 放大生成 2×。
- **bust 锚点 (64, 152)**：仅表示半身像在详情容器内的 **挂载定位点**；**不要求**肩线落在画布底边。画幅顶 **≥12px**、底 **≥16px** 为纯呼吸留白（底部 **16px 不是**名字条叠压区）。
- **详情名字**：展示名在 bust **右侧** 约 **10px** 处排版，**不**覆盖人物轮廓；与 [heroPanelTextContrast](../../client/src/engine/heroPanelTextContrast.ts) 墨色文案并存。

- `crop_offset`：Batch 1 **省略**或 `{0,0}`（与 ART-SAMPLE-001 一致）。
- 列表行命中区仍遵守 **≥44×44** CSS（头像可 56 逻辑，由后续 CLIENT 皮肤挂载时包一层 wrap）。
- 详情 bust 挂在 `.hero-detail` 墨底区（`ui.panel.hero.v1` 内）；底部 **16px** 仍须保留透明呼吸边，勿为「留名字」而裁切肩胸关键轮廓。

### 运行时挂载（工程后续 PR，非本卡）

| 表面 | 预留 DOM / 行为 |
|---|---|
| 列表 | `li[data-hero-id]` 内、`hero-list-row-body` **之前**：`img[data-role="hero-list-avatar"]`，`alt` 用模板名 |
| 详情 | `.hero-detail-head` **之前**：`img[data-role="hero-detail-bust"]` |
| 解析 | `template_cfg_id` → `hero.avatar.<id>.v1` / `hero.bust.<id>.v1`；`getArtMeta` 无条目或 PNG 404 → **不插入 img**（等同今日） |
| 跳过皮肤 | 祖先 `data-art-skin="off"` 与现有面板一致 |

## 文件路径（1× / 2×）

根：`client/public/assets/art/v1/`（URL `/assets/art/v1/`）。

| kind | 1× 路径 | 2× 路径 |
|---|---|---|
| avatar | `textures/1x/hero/avatar/<template_cfg_id>.png` | `textures/2x/hero/avatar/<template_cfg_id>.png` |
| bust | `textures/1x/hero/bust/<template_cfg_id>.png` | `textures/2x/hero/bust/<template_cfg_id>.png` |

示例（1001）：

- `textures/1x/hero/avatar/1001.png`
- `textures/2x/hero/avatar/1001.png`
- `textures/1x/hero/bust/1001.png`
- `textures/2x/hero/bust/1001.png`

**禁止** 使用 `template_code` 作文件名（避免 YAML 重命名与磁盘漂移）；code 仅出现在 `tags` / 交付台账。

## 美术提交的 manifest 元数据

美术 **不编辑** `client/public/assets/art/v1/schema/`。交付物：

1. PNG（成对 1×/2×）
2. **manifest 片段**：`assets` **数组**（每条为一个 asset 对象），或仅含 schema 允许的顶层键的 JSON 包：`schema_version`、`pack`、`texture_delivery`（可选）、`base_url`（可选）、`assets`。整包示例见 [`manifest.hero-portraits.example.json`](../../client/public/assets/art/v1/manifest.hero-portraits.example.json)（**不得**含 `description` 等额外顶层键）。
3. 可选：`INVENTORY.md`（模板 id 清单 + SHA256）

**校验口径**：

- **片段**：每个 asset 单独包一层后校验：`{"schema_version":1,"pack":"hero","base_url":"/assets/art/v1/","assets":[<entry>]}`。
- **整文件示例**：`manifest.hero-portraits.example.json` **作为完整 manifest 对象**亦须通过同一 schema（`additionalProperties: false`）。

每个 `asset` 对象必填字段：

| 字段 | avatar | bust |
|---|---|---|
| `id` | `hero.avatar.<id>.v1` | `hero.bust.<id>.v1` |
| `kind` | `hero_avatar` | `hero_bust` |
| `template_cfg_id` | 整数 | 同左 |
| `display_size` | 见上表 | 见上表 |
| `anchor` + `anchor_unit: "pixels"` | 见上表 | 见上表 |
| `variants` | scale **1** 与 **2** 各一条 `path` | 同左 |
| `texture_delivery` | 包级或继承 `standalone_png` | 同左 |

工程合并方式：将片段 **追加** 到 `client/public/assets/art/v1/manifest.json`（单独 PR，或与本批纹理同 PR）；合并前用 schema 校验（见下方验证）。

## 分阶段交付建议

| 阶段 | `template_cfg_id` | 数量 | 理由 |
|---|---|---:|---|
| **Slice 0（建议先冻）** | **1001** | **1** | 仅 2 个 asset 条目 + 4 张 PNG；先验证契约与挂载，再扩批 |
| **Slice 1** | **1002–1004** | **3** | 与客户端冒烟子集 `heroTemplateLabel`（1001–1004）、招募默认 1001、INTG 固定 id 对齐 |
| **Slice 2** | **1005–1008** | **4** | 黄忠 / 马超 / 诸葛亮 / 周瑜；#108 联合冻结后可开绘（8 asset / 16 PNG） |
| **Slice 3** | 1013–1040 | 28 | 余下 DATA-002 模板直至满批 |
| **Full core（目标）** | 1001–1040 | **40** | Batch 1 完整目标（80 个 asset 条目 = 40×2）；**40 为终态目标，非当前起步张数** |

### Slice 0 明细（**史实身份已冻结 — 像素已交付**）

| template_cfg_id | code | 绘制人物（冻结） |
|---:|---|---|
| 1001 | `xuan_de_lord` | **刘备** |

### Slice 1 扩批明细（1002–1004 — **史实身份已冻结 — 像素已交付**）

美术按 **`historical_identity` / 展示名** 绘制对应历史人物（非风味代号）。1009+ 草案见 [hero-template-historical-identity.md](./hero-template-historical-identity.md)。

| template_cfg_id | code | 绘制人物（冻结） |
|---:|---|---|
| 1002 | `green_dragon` | **关羽** |
| 1003 | `thunder_spear` | **张飞** |
| 1004 | `silver_rider` | **赵云** |

### Slice 2 明细（1005–1008 — **史实身份 + 宿主契约已冻结 — 待交付像素**）

PR #108 联合冻结后授权美术绘制；**不**包含旧文档中的 1005–1012 八人批。

| template_cfg_id | code | 绘制人物（冻结） |
|---:|---|---|
| 1005 | `sun_archer` | **黄忠** |
| 1006 | `wind_cavalry` | **马超** |
| 1007 | `jade_strategist` | **诸葛亮** |
| 1008 | `fire_general` | **周瑜** |

`alt` 文案与 manifest 台账使用上表中文名；`template_code` 仅作工程联结键。稳定 `asset_id`：`hero.avatar.<id>.v1`、`hero.bust.<id>.v1`；路径见上文「文件路径」。

完整 40 模板 code 表见 `spec/data/generated/cfg_hero_template.sql` 或 `heroes.yml`。

## 验收

1. **Schema**：`manifest.hero-portraits.example.json` 整文件通过 schema；片段中每个 asset 经单层包裹后亦通过（`pack=hero`，`kind` 为 `hero_avatar` / `hero_bust`，含 `template_cfg_id`）。
2. **文件**：每个 `variants[].path` 在仓库中存在对应 PNG；1×/2× 成对；RGBA；透明底。
3. **尺寸**：解码后 1× 边长 = `display_size`；2× 边长 = `display_size × 2`（容差 ±0）。
4. **游戏（挂载 PR 之后）**：1600×900 DPR1/DPR2 打开将领面板——列表行见 avatar；点选详情见 bust；对 **未交付** 的 template 仍无图。
5. **回归**：`data-art-skin="off"` 时与今日纯文案一致；不改动玩法 RPC。

## 验证命令（工程 / CI）

```bash
# 需 Python 3 + jsonschema（或 npx 等价）
python3 - <<'PY'
import json, pathlib
from jsonschema import validate
root = pathlib.Path("client/public/assets/art/v1")
schema = json.loads((root / "schema/asset-manifest.schema.json").read_text())
# 校验完整 manifest（合并后，若存在）
manifest_path = root / "manifest.json"
if manifest_path.is_file():
    manifest = json.loads(manifest_path.read_text())
    validate(manifest, schema)
# 整文件示例 + 逐条片段
example = json.loads((root / "manifest.hero-portraits.example.json").read_text())
validate(example, schema)
for entry in example["assets"]:
    validate({"schema_version": 1, "pack": "hero", "base_url": "/assets/art/v1/", "assets": [entry]}, schema)
print("ok")
PY
```

文档-only PR：运行 schema 校验 + 确认 `manifest.json` **未**误加未存在纹理路径即可。

## 相关只读参照

- 面板皮：`ui.panel.hero.v1` → `panel_hero.png`（非将领肖像）
- 底栏：`ui.icon.toolbar.hero.v1` → `icon_toolbar_hero.png`
- Draft 样件：`docs/art/samples/art-center-panel-012/`（#697 hold，未合并）

## 变更记录

| 日期 | 说明 |
|---|---|
| 2026-10-24 | ART-HERO-AVATAR-BUST-001 初稿：命名、路径、40 模板分批、schema `hero_*` kind |
| 2026-10-24 | 跟进 #108：圆形遮罩工程侧、安全区/2× 原生、bust 锚点语义、manifest 顶层键、Slice 0（1001）、示例 JSON 去非法 `description` |
| 2026-10-24 | HERO-HIST-NAME-001：1001–1004 冻结刘备/关羽/张飞/赵云；链出史实映射文档 |
| 2026-10-24 | #108 Slice 2 联合冻结：1005–1008（4 人）、宿主契约（底 16px 呼吸非名字条、名字在 bust 右侧 10px、锚点仅定位、顶 12/底 16、面部 ≥60% / 1001 特例不延续）；状态横幅区分已交付 Slice 0–1 |
