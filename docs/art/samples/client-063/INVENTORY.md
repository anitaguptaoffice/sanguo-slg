# CLIENT-063 代表队列上沿证据索引

仅 `queue-representative` 三视口。根因：Playwright `element.screenshot` 在 `overflow:auto` + 九宫格 `border-image` 时上沿约 24px 呈 viewport 底色；改用 `page.screenshot` 按元素 border box 裁剪。

| 证据 tip SHA | `2ff63ad38ee68740f65c0a0c486bf1351c3aa124` |
|---|---|

| 路径 | 字节 | SHA-256 | 视口 | 面板 | 状态 |
|---|---:|---|---|---|---|
| `docs/art/samples/client-063/queue-representative-1600-dpr1.jpg` | 17317 | `3557ce4ff4b8ebf64a713209ab19e441f75aa95a7706290efe2d6a581cf87442` | 1600×900 DPR1 | queue | representative-center-panel |
| `docs/art/samples/client-063/queue-representative-1600-dpr2.jpg` | 48684 | `99ac1991a3ab4e46ce5034abef762a12611b16eb39b522d159d92c369f1a2fce` | 1600×900 DPR2 | queue | representative-center-panel |
| `docs/art/samples/client-063/queue-representative-1280.jpg` | 14121 | `f0374d5332374f056f93f729b6aa106b47e5e5e9bce03f055f0404c7fd213879` | 1280×720 DPR1 | queue | representative-center-panel |

## 复现

```bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-063-evidence.mjs
```
