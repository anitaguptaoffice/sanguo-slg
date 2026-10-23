# CLIENT-046 中心四面板独立视觉证据

队列 / 邮件 / 日常（chain 400）/ 背包 — 复用 **`ui.panel.default.v1`** 与 **`ui.button.primary.v1`**，不新增美术 PNG。

## 与军事 PASS 的关系

CLIENT-040（`docs/art/samples/client-040/`）军事 1280 全页 **PASS 已闭环**；本目录为四中心面板的**独立**证据，**不得**将军事 PASS 类推为队列/邮件/日常/背包通过。

## 索引

完整路径、字节、视口与状态见 [`INVENTORY.md`](./INVENTORY.md)（由捕获脚本生成，含证据 tip SHA）。

## 复现捕获

```bash
cd client
npm install
npx playwright install chromium
node scripts/capture-client-046-evidence.mjs
```

- Mock 网关通过 `POST /_evidence/preset` 切换会话桩（见 `mock-server/server.mjs`）。
- 输出 JPEG，单张 **<1MB**（Playwright `quality` 压缩，不缩放像素）。
- 优先使用捕获时 `main` 的 `git rev-parse HEAD` 作为 tip SHA。

## 审阅对照

冻结清单：[PR #108 评论](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6368969793)  
触发说明：[PR #108 评论](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6370092490)
