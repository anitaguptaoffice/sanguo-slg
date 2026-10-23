# Art pack v1（DRAFT）

## 本阶段交付（ART-SAMPLE-001）

- **纹理**：`textures/1x/`、`textures/2x/` 下**独立 PNG**，透明底按资源类型要求；**不打图集**。
- **倍率**：六类样件均 **1× + 2×**；按钮 **每一态** 各一张 1×、一张 2×。
- **背景**：文件像素 **1600×788**（舞台尺寸），非 1600×900。
- **裁切**：样件批 `crop_offset` 省略或 `{0,0}`；无 trim 验收要求。图集 / 裁切协议稳定后再做管线级验收。
- **基准提交**：对齐 PR **#100** 分支 `cursor/art-pipeline-docs-cffb` 上文档与 schema **即可出样**，无需合并 #100。

## 文件

| 路径 | 说明 |
|---|---|
| `schema/asset-manifest.schema.json` | 工程维护（DRAFT） |
| `manifest.example.json` | 六类样件结构示例 |
| `textures/` | 样件到位后放 PNG |

URL 前缀：`/assets/art/v1/`（叠加 Vite `base`）。

## 暂缓

军事面板皮肤、聊天/军团/排行 UI：**下一批**，不在 ART-SAMPLE-001。
