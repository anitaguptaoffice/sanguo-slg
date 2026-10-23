# Art pack v1（DRAFT）

- **Schema（工程维护，美术只读）**：`schema/asset-manifest.schema.json`
- **示例清单**：`manifest.example.json`（非运行时文件；正式 `manifest.json` 由工程在接入时生成）
- **纹理目录**（样本到位后）：`textures/1x/`、`textures/2x/`、`atlases/`

路径解析规则见 schema 内 `path` 字段说明。部署后 URL 前缀：`/assets/art/v1/`（受 Vite `base` 影响时加前缀）。
