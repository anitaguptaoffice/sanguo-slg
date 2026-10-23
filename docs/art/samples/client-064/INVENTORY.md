# CLIENT-064 代表队列上沿证据索引

仅 `queue-representative` 三视口。**完整浏览器视口**截图（`page.screenshot({ fullPage: false })`），非 `element.screenshot`、非 bbox 裁切。

| 证据 tip SHA | `6d99cddcc35aaa0eaedcb667e64cde04ae34f7ca` |
|---|---|

| 路径 | 字节 | SHA-256 | 视口 | 几何 / 滚动 | 状态 |
|---|---:|---|---|---|---|
| `docs/art/samples/client-064/queue-representative-1600-dpr1.jpg` | 365773 | `a0bb466a8f4fa0b1f44a25212cb95dea75cdef6f84f03e9debbc4af396decb97` | 1600×900 DPR1 | scroll (0, 0); viewport 1600×900 @DPR1; panel [480,56 640×788]; title [516,92 568×20] | full-viewport-queue-open |
| `docs/art/samples/client-064/queue-representative-1600-dpr2.jpg` | 845836 | `b8f9f1191d3154c4039785e452da12719b10d329403504a07b26f4c92d3927ef` | 1600×900 DPR2 | scroll (0, 0); viewport 1600×900 @DPR2; panel [480,56 640×788]; title [516,92 568×20] | full-viewport-queue-open |
| `docs/art/samples/client-064/queue-representative-1280.jpg` | 199935 | `35b171a4fb509c4e16b92a05e5d069403a8fd559596dd68be015f2fe3a624b04` | 1280×720 DPR1 | scroll (0, 0); viewport 1280×720 @DPR1; panel [320,44.8 640×630.41]; title [356,80.8 568×20] | full-viewport-queue-open |

## 复现

```bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-064-evidence.mjs
```
