# 占位 ID → 稳定 asset_id（DRAFT）

来源：`client/src/engine/AssetLoader.ts` 当前占位列表 + 主城场景隐式色块。

| 旧占位 / 隐式用途 | 新稳定 `asset_id` | 类型 |
|---|---|---|
| `bg_maincity` | `mc.bg.plateau.v1` | 主城背景（无建筑、无文字） |
| `ui_panel` | `ui.panel.default.v1` | 九宫格面板 |
| `icon_food` | `res.icon.food.v1` | 资源图标 |
| （未建占位）`icon_wood` | `res.icon.wood.v1` | 资源图标 |
| （未建占位）`icon_stone` | `res.icon.stone.v1` | 资源图标 |
| （未建占位）`icon_iron` | `res.icon.iron.v1` | 资源图标 |
| （未建占位）`btn_generic` | `ui.button.primary.v1` | 四态按钮 |
| MainCityScene 建筑色块 | `mc.building.<slot_key>.v1` | 见 [maincity-slots.md](./maincity-slots.md) |

加载器在迁移期可同时接受旧 id（通过 `PLACEHOLDER_TO_STABLE_ID`）与新 `asset_id`。

## 将领肖像（Batch 1，按 `template_cfg_id`）

联结 DATA-002 `cfg_hero_template.template_cfg_id`（1001 起）。**非**玩家 `hero_id`。

| 用途 | `asset_id` 模式 | 示例 |
|---|---|---|
| 列表头像 | `hero.avatar.<template_cfg_id>.v1` | `hero.avatar.1001.v1` |
| 详情半身 | `hero.bust.<template_cfg_id>.v1` | `hero.bust.1001.v1` |

路径与验收见 [hero-avatar-bust-batch.md](./hero-avatar-bust-batch.md)。
