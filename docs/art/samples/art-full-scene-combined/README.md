# 组合主城场景 VERIFY（工程证据包）

**性质**：独立 Draft VERIFY PR，**请勿合并**。供美术 **组合场景终验**；各专项 VERIFY 的有限 PASS **不构成**全局 PASS。

## 范围

- **14** 个稳定 `asset_id`，**34** 张 standalone PNG（见 `INVENTORY.json`）
- 运行时：`layoutViewport` DPR 叠乘、HUD 四资源 canvas 行、`wall` 槽 `mc.building.wall.v1`
- 背景像素：`#126` @ `d05d68d`（替换 #108 上采样 2× 背景）

## 证据

| 文件 | 说明 |
|---|---|
| `screenshots/maincity-full-scene-1600x900-dpr1.png` | DPR1 全布局帧 PNG |
| `screenshots/maincity-full-scene-1600x900-dpr1.jpg` | DPR1 可读压缩（审阅用） |
| `screenshots/maincity-full-scene-1600x900-dpr2.png` | DPR2 全布局帧 PNG |
| `screenshots/maincity-full-scene-1600x900-dpr2.jpg` | DPR2 可读压缩（审阅用） |
| `viewport-metadata.json` | 视口 / backing / DPR 元数据 |
| `INTEGRATION-QA.md` | 工程自检表与发布包排除项 |

## 复现

```bash
cd client && npm ci && npm test && npm run build
node scripts/verify-art-full-scene-inventory.mjs
node scripts/capture-art-full-scene-combined-verify.mjs
```

固定证据 SHA 见本 PR 正文（分支 HEAD）。
