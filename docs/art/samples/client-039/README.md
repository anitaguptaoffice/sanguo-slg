# CLIENT-039 顶栏 HUD 叠字修复证据

## 根因与修复

- **根因**：`MainCityScene.draw` 在 canvas 顶栏带（`STAGE_TOP_Y`）绘制 `res.icon.*` 与粮木铁石数值，同时 `renderHud` 经 `appendHudResourceStrip` 在 DOM `#hud`（`z-index: 2`）绘制同一套资源。两层同坐标叠加，1280×720 军事面板打开时目视叠字。
- **修复**：顶栏资源**仅 DOM**（`#hud .hud-resource-strip`）；canvas 只保留顶/底不透明色带与主城舞台内容。`#hud` 增加 `background: rgba(26, 20, 16, 0.92)` 与 canvas 顶栏背板一致。

| 层 | 顶栏资源 | 顶栏背板 |
|---|---|---|
| Canvas `#game` | 不再绘制 | `fillRect(0,0,w,STAGE_TOP_Y)` 半透明深色 |
| DOM `#hud` | `appendHudResourceStrip` + 主城/建筑/状态文案 | CSS `background` |

## 复现截图

```bash
cd client
node scripts/capture-client-039-evidence.mjs
```

| 文件 | 说明 |
|---|---|
| `military-1280x720-dpr1-full.png` | 1280×720 DPR1，军事面板打开，**完整** `#layout-frame` |
| `military-1280x720-dpr1-top-hud.png` | 同上视口顶栏 `#hud` 裁条 |

CLIENT-033 军事字色 / 募兵四态证据仍在 `docs/art/samples/client-033/`（本卡未重做）。
