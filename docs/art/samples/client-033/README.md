# CLIENT-033 军事面板运行时修复证据

在 `make dev` 或 mock 网关下复现：

```bash
cd client
node scripts/capture-client-033-evidence.mjs
```

产出（单张目标 &lt;1MB）：

| 文件 | 说明 |
|---|---|
| `military-1600x900-dpr1.jpg` | 1600×900 DPR1，军事面板打开（右侧裁图） |
| `military-1600x900-dpr2.jpg` | 1600×900 DPR2，军事面板打开 |
| `military-1280x720-dpr1.png` | 1280×720 DPR1 顶栏 HUD（叠字修复） |
| `btn-recruit-*.png` | 募兵主按钮 normal / hover / pressed / disabled 四态 |

**口径**：`420×320` 为军事面板 `min-width` / `min-height` 契约；打开后实际高度随视口在顶底栏之间拉伸，不以 min-size 描述截图尺寸。
