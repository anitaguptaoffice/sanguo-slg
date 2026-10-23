# CLIENT-054 中心四面板 FAIL 修复证据

队列 / 邮件 / 日常（chain 400）/ 背包 — 纸底深色字色 + `ui.button.primary.v1` 主操作接线（相对 CLIENT-046 美术 FAIL）。

## 索引

完整路径、字节、视口与状态见 [`INVENTORY.md`](./INVENTORY.md)（含固定证据 tip SHA）。

## 复现捕获

```bash
cd client
npm install
npx playwright install chromium
node scripts/capture-client-054-evidence.mjs
```

## 审阅对照

- 触发：[PR #108 评论 6370610682](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6370610682)
- CLIENT-046 合入 tip：`305036dfbd5d287cc3b92f6c920d738e2348289b`（本目录为修复后新证据，不覆盖 client-046 历史包）
