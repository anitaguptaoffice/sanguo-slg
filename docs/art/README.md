# 美术管线（工程侧草案）

> **状态：DRAFT — 未冻结。** 由工程维护 schema 与目录约定；美术在互审后按 schema 填元数据，**不直接改** `client/public/assets/art/v1/schema/` 下的文件。

## 发布目录

运行时资源根路径（Vite `base` 默认为 `/`）：

`client/public/assets/art/v1/`

浏览器解析为 `/assets/art/v1/...`。

## 文档索引

| 文档 | 内容 |
|---|---|
| [layout-landscape.md](./layout-landscape.md) | PC 横屏布局基线、缩放策略、与当前竖屏占位的关系 |
| [maincity-slots.md](./maincity-slots.md) | 主城槽位 `slot_key` 显示约定（不改升级协议） |
| [id-mapping.md](./id-mapping.md) | 旧占位 ID → 新稳定 `asset_id` |
| [../reference.md](../reference.md) | 原版参照分支只读说明（**禁止**合并 #77 / #82） |

## 工作流（样本 → 批量）

1. 工程 + 美术评审本目录文档与 `v1/schema`（本 PR）。
2. 美术按 **ART-SAMPLE-001**（见 `tasks/backlog.yml`）出第一套样本 PNG/WebP。
3. 工程在占位横屏布局上接入 manifest 加载（后续 CLIENT 卡），验证后再开批量生产卡。

本轮 **不含** 聊天 / 军团 / 排行专用 UI 美术。
