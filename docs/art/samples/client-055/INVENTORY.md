# CLIENT-055 中心四面板证据索引

CLIENT-054 美术 FAIL 余项：primary 160×48 完整接线、纸底漏网字色、代表截图/按钮 bounding box 重拍。

| 证据 tip SHA | `b63ed95480293cb8eeca6cd520c36647b18a8cab` |
|---|---|

| 路径 | 字节 | 视口 | 面板 | 状态 | 备注 |
|---|---:|---|---|---|---|
| `docs/art/samples/client-055/queue-representative-1600-dpr1.jpg` | 33260 | 1600×900 DPR1 | queue | representative-center-panel |  |
| `docs/art/samples/client-055/queue-representative-1600-dpr2.jpg` | 88508 | 1600×900 DPR2 | queue | representative-center-panel |  |
| `docs/art/samples/client-055/queue-representative-1280.jpg` | 29383 | 1280×720 DPR1 | queue | representative-center-panel |  |
| `docs/art/samples/client-055/mail-selected-claim.jpg` | 42239 | 1600×900 DPR1 | mail | selected-detail-claim-visible |  |
| `docs/art/samples/client-055/mail-selected-no-claim.jpg` | 34558 | 1600×900 DPR1 | mail | selected-detail-claim-hidden |  |
| `docs/art/samples/client-055/mail-list-error.jpg` | 30319 | 1600×900 DPR1 | mail | inbox-load-error |  |
| `docs/art/samples/client-055/bag-empty.jpg` | 33240 | 1600×900 DPR1 | bag | empty |  |
| `docs/art/samples/client-055/queue-refresh-btn-normal.jpg` | 2950 | 1600×900 DPR1 | queue | button-normal | computed 160px×48px (client 160×48) |
| `docs/art/samples/client-055/queue-refresh-btn-hover.jpg` | 2977 | 1600×900 DPR1 | queue | button-hover | computed 160px×48px (client 160×48) |
| `docs/art/samples/client-055/queue-refresh-btn-pressed.jpg` | 2927 | 1600×900 DPR1 | queue | button-pressed | computed 160px×48px (client 160×48) |
| `docs/art/samples/client-055/queue-refresh-btn-disabled.jpg` | 2521 | 1600×900 DPR1 | queue | button-disabled | computed 160px×48px (client 160×48) |
| `docs/art/samples/client-055/mail-toolbar-actions.jpg` | 6751 | 1600×900 DPR1 | mail | mail-filter-and-refresh-primary | first primary computed 160px×48px |
| `docs/art/samples/client-055/daily-toolbar-actions.jpg` | 7070 | 1600×900 DPR1 | daily | daily-refresh-accept-claim-primary | first primary computed 160px×48px |
| `docs/art/samples/client-055/bag-toolbar-actions.jpg` | 5431 | 1600×900 DPR1 | bag | bag-refresh-use-primary | first primary computed 160px×48px |

## 复现

```bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-055-evidence.mjs
```
