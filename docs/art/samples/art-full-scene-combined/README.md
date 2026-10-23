# 组合主城场景样件清单（main 落地）

**14** 个稳定 `asset_id`、**34** 张 standalone PNG；与 `client/public/assets/art/v1/manifest.json` 及运行时主城槽位/HUD 一致。

## 来源 PR（已验收交付，非 #77/#82）

| 内容 | PR | 提交（tip） |
|---|---|---|
| 布局/schema（main 已有部分） | #100 | `645b488…` |
| 初始 18 张样件（hall/farm/ui/food 等） | #108 | `54394ad4…` |
| HD 背景 1×/2× | #126 | `d05d68d6…` |
| 四建筑 | #140 | `5a2d3ef0…` |
| 木/铁/石 HUD 图标 | #144 | `02399f6f…` |
| 后景墙 | #153 | `0d9ea5bc…` |

VERIFY 分支 #177 / #141 / #145 / #155 仅作工程证据参考；**本目录不含** VERIFY 全景截图树（见各 VERIFY PR）。

## 文件

| 文件 | 说明 |
|---|---|
| `INVENTORY.json` | 路径、SHA256、来源提交；`integrity.pass` 应为 true |
| `INTEGRATION-QA.md` | 工程自检与发布包排除项 |

## 校验

```bash
cd client && npm ci && npm test && npm run build
node scripts/verify-art-full-scene-inventory.mjs
```
