# CLIENT-040 1280 军事全页可读证据（压缩）

美术侧连接器无法读取 CLIENT-039 的完整 PNG（约 1.21MB）。本目录提供**同像素**（1280 宽、`#layout-frame` 裁切）的 WebP/JPEG，单文件 **<1MB**，供全页目视；**不**表示全页或各中心面板已签 off——HUD 裁条 PASS 仍以 `client-039/military-1280x720-dpr1-top-hud.png` 为准（见 [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108)）。

## 版本锚点

| 项 | SHA / 说明 |
|---|---|
| CLIENT-039 merge | `9e98a28bfcc27714addb28343ed8c1a7136ca9b7`（PR #260） |
| 证据 tip（优先） | `c98118803d0bc597e4b6daf0878bad86fdf586cd` |
| 当前 main | 已包含上述 merge；全页 PNG 未改像素，仅新增本目录压缩件 |

## 源 PNG（保留）

| 文件 | 尺寸 | 字节 |
|---|---|---|
| `../client-039/military-1280x720-dpr1-full.png` | **1280×717**（`#layout-frame` 实际高度） | 1,212,699 |

视口为 1280×720 DPR1；裁切框高度 717 与 CLIENT-039 捕获脚本一致，非缩放。

## 压缩产物（本目录）

| 文件 | 格式 | 参数 | 字节（生成时） |
|---|---|---|---|
| `military-1280x720-dpr1-full.webp` | WebP | ffmpeg `libwebp -quality 85`，无缩放 | 200,838 |
| `military-1280x720-dpr1-full.jpg` | JPEG | ffmpeg `-q:v 4`（约高质量），无缩放 | 291,062 |

重新生成：

```bash
cd client
node scripts/compress-client-040-evidence.mjs
```

依赖：系统 `ffmpeg`（读 `client-039` PNG，写本目录）。

## 与 CLIENT-039 关系

- HUD 叠字修复与 **顶栏裁条** 证据：`docs/art/samples/client-039/`
- 军事字色 / 募兵四态：`docs/art/samples/client-033/`
- 本卡 **不**修改任何 PNG 像素、不扩展 HUD PASS 为全页 PASS
