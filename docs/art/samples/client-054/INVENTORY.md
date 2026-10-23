# CLIENT-054 中心四面板证据索引

CLIENT-046 美术 FAIL 后的纸底字色 + primary 接线修复。皮肤：`ui.panel.default.v1` + `ui.button.primary.v1`。**不**将 CLIENT-040 军事 PASS 扩展为本目录四面板。

| 证据 tip SHA | `1ee7691a1455b9c8eb245116ac9357027fecac2e` |
|---|---|

| 路径 | 字节 | 视口 | 面板 | 状态 | 备注 |
|---|---:|---|---|---|---|
| `docs/art/samples/client-054/queue-build-rows.jpg` | 33238 | 1600×900 DPR1 | queue | build-upgrade-rows |  |
| `docs/art/samples/client-054/queue-empty.jpg` | 34865 | 1600×900 DPR1 | queue | empty |  |
| `docs/art/samples/client-054/queue-representative-1600-dpr1.jpg` | 33238 | 1600×900 DPR1 | queue | representative-center-panel |  |
| `docs/art/samples/client-054/queue-representative-1600-dpr2.jpg` | 94322 | 1600×900 DPR2 | queue | representative-center-panel |  |
| `docs/art/samples/client-054/queue-representative-1280.jpg` | 29091 | 1280×720 DPR1 | queue | representative-center-panel |  |
| `docs/art/samples/client-054/mail-unread-list.jpg` | 45589 | 1600×900 DPR1 | mail | unread-list |  |
| `docs/art/samples/client-054/mail-empty-all.jpg` | 35789 | 1600×900 DPR1 | mail | empty-all-filter |  |
| `docs/art/samples/client-054/mail-selected-claim.jpg` | 45589 | 1600×900 DPR1 | mail | selected-detail-claim-visible |  |
| `docs/art/samples/client-054/mail-selected-no-claim.jpg` | 37426 | 1600×900 DPR1 | mail | selected-detail-claim-hidden |  |
| `docs/art/samples/client-054/mail-list-error.jpg` | 34205 | 1600×900 DPR1 | mail | inbox-load-error |  |
| `docs/art/samples/client-054/daily-items-selected.jpg` | 52174 | 1600×900 DPR1 | daily | items-and-selected |  |
| `docs/art/samples/client-054/daily-empty.jpg` | 39137 | 1600×900 DPR1 | daily | empty-list |  |
| `docs/art/samples/client-054/daily-after-claim.jpg` | 43111 | 1600×900 DPR1 | daily | state4-claimed-static |  |
| `docs/art/samples/client-054/bag-stacks.jpg` | 45269 | 1600×900 DPR1 | bag | stacks |  |
| `docs/art/samples/client-054/bag-empty.jpg` | 38531 | 1600×900 DPR1 | bag | empty |  |
| `docs/art/samples/client-054/bag-use-fail.jpg` | 43100 | 1600×900 DPR1 | bag | use-fail-feedback |  |
| `docs/art/samples/client-054/queue-refresh-btn-normal.jpg` | 2002 | 1600×900 DPR1 | queue | refresh-button-normal | 刷新内政 primary 按钮 bounding box |
| `docs/art/samples/client-054/queue-refresh-btn-hover.jpg` | 2268 | 1600×900 DPR1 | queue | refresh-button-hover | 刷新内政 primary 按钮 bounding box |
| `docs/art/samples/client-054/queue-refresh-btn-pressed.jpg` | 2321 | 1600×900 DPR1 | queue | refresh-button-pressed | 刷新内政 primary 按钮 bounding box |

## 范围限制

- 日常 DPR2、背包 1280×720：本包未单独重拍（与 #108 冻结清单一致，记为范围限制）。
- `daily-after-claim`：mock state=4 静态呈现，**不**冒充领奖点击成功动效。
- 代表中心面板视口三连拍：以队列 `queue-representative-*` 为样例。

## 复现

```bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-054-evidence.mjs
```
