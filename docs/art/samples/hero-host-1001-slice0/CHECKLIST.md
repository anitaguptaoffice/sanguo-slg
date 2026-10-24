# HERO-HOST-1001 slice:0 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 轮次 | 工程 / 代码 SHA | 范围 | 说明 |
|---|---|---|---|
| **原矩阵 capture** | `d078ca9d42e4256b0533b03f707b77e389db4ea3` | 1600 dpr1/dpr2、1280 详情末尾等 | 美术已在 #108 复核通过项；**勿删勿全矩阵重拍** |
| **美术审 #984 固定** | `70d90432db231b20a20f47cf0c6d49f833a1399e` | 同上证据集 | #108 评论 6385191293 对照的 PR 头 |
| **同帧补图（本次）** | 见 `probe-log-supplement-bust-name-sameframe.json` → `supplement_runtime_code_sha`（与 #984 推送提交一致） | 仅 `hero-host-1280x720-dpr1-bust-name-sameframe.jpg` | 生产主城链路；详情头部滚位，非列表/非尾部 |
| **美术源** | `eef9514b507c3b21921987ab94232021422bdc2f` | Draft #983 四 PNG | blob 与 manifest `slice:0` |

## 验收表

| 项 | 结果 | 备注 |
|---|---|---|
| 仅 2 ID / 4 PNG + manifest `slice:0` | PASS | 自 Draft #983 @ `eef9514b` 路径复制，未合并 #983 |
| 生产主城 mock 进服 → 将领面板 | PASS | `hero-panel-roster` preset，刘备 `template_cfg_id=1001` |
| 56px 圆角头像 + 邻行主名深字 | PASS（已审） | `hero-host-1600x900-dpr1.jpg` / `dpr2` |
| DPR2 走 2× 纹理 | PASS（已审） | `hero-host-1600x900-dpr2.jpg` + probe |
| 1280 详情区滚动至末尾 | PASS（已审） | `hero-host-1280x720-dpr1.jpg`（**非**同帧补图） |
| **1280 半身 + 右侧名字同帧** | **待美术目视** | 工程补图：`runtime/hero-host-1280x720-dpr1-bust-name-sameframe.jpg`；probe `gapPx` / `verticalBandOverlap` 见 supplement JSON |
| 刘备 1001 面部比例 57.8% | 未自动测 | #108 特例；美术目视 |

## 产物路径

**保留（原矩阵，d078ca9d）**

- `runtime/hero-host-1600x900-dpr1.jpg`
- `runtime/hero-host-1600x900-dpr2.jpg`
- `runtime/hero-host-1280x720-dpr1.jpg`
- `runtime/probe-log.json`
- `runtime/INVENTORY.md`

**同帧补图（单独 SHA，见 supplement probe）**

- `runtime/hero-host-1280x720-dpr1-bust-name-sameframe.jpg`
- `runtime/probe-log-supplement-bust-name-sameframe.json`
