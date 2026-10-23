# CLIENT-046 中心四面板证据索引

皮肤：`ui.panel.default.v1` + `ui.button.primary.v1`（与军事 `ui.panel.military.v1` 无关）。**不**将 CLIENT-040 军事 PASS 扩展为本目录四面板。

| 证据 tip SHA | `c6f422ade35eac19adb5d29cd6ee0870f96a3755` |
|---|---|

| 路径 | 字节 | 视口 | 面板 | 状态 |
|---|---:|---|---|---|
| `docs/art/samples/client-046/queue-empty.jpg` | 30287 | 1600×900 DPR1 | queue | empty |
| `docs/art/samples/client-046/queue-empty-1280.jpg` | 24217 | 1280×720 DPR1 | queue | empty |
| `docs/art/samples/client-046/queue-build-rows.jpg` | 31698 | 1600×900 DPR1 | queue | build-upgrade-rows |
| `docs/art/samples/client-046/queue-recruit-row.jpg` | 33917 | 1600×900 DPR1 | queue | recruit-row |
| `docs/art/samples/client-046/queue-build-dpr2.jpg` | 89625 | 1600×900 DPR2 | queue | build-upgrade-rows |
| `docs/art/samples/client-046/mail-empty-all.jpg` | 35696 | 1600×900 DPR1 | mail | empty-all-filter |
| `docs/art/samples/client-046/mail-empty-unread.jpg` | 32741 | 1600×900 DPR1 | mail | empty-unread-filter |
| `docs/art/samples/client-046/mail-unread-list.jpg` | 43417 | 1600×900 DPR1 | mail | unread-list |
| `docs/art/samples/client-046/mail-unread-list-dpr2.jpg` | 116660 | 1600×900 DPR2 | mail | unread-list |
| `docs/art/samples/client-046/mail-selected-claim.jpg` | 41560 | 1600×900 DPR1 | mail | selected-detail-claim-visible |
| `docs/art/samples/client-046/mail-selected-no-claim.jpg` | 30529 | 1280×720 DPR1 | mail | selected-detail-claim-hidden |
| `docs/art/samples/client-046/daily-empty.jpg` | 35727 | 1600×900 DPR1 | daily | empty-list |
| `docs/art/samples/client-046/daily-items-selected.jpg` | 49582 | 1600×900 DPR1 | daily | items-and-selected |
| `docs/art/samples/client-046/daily-after-accept.jpg` | 45211 | 1280×720 DPR1 | daily | after-accept |
| `docs/art/samples/client-046/daily-after-claim.jpg` | 39714 | 1600×900 DPR1 | daily | after-claim |
| `docs/art/samples/client-046/bag-empty.jpg` | 32085 | 1600×900 DPR1 | bag | empty |
| `docs/art/samples/client-046/bag-stacks.jpg` | 38076 | 1600×900 DPR1 | bag | stacks |
| `docs/art/samples/client-046/bag-stacks-dpr2.jpg` | 107736 | 1600×900 DPR2 | bag | stacks |
| `docs/art/samples/client-046/bag-use-success.jpg` | 42481 | 1600×900 DPR1 | bag | use-success-feedback |
| `docs/art/samples/client-046/bag-use-fail.jpg` | 35855 | 1600×900 DPR1 | bag | use-fail-feedback |
| `docs/art/samples/client-046/queue-refresh-btn-normal.jpg` | 2024 | 1600×900 DPR1 | queue | refresh-button-normal |
| `docs/art/samples/client-046/queue-refresh-btn-hover.jpg` | 1854 | 1600×900 DPR1 | queue | refresh-button-hover |
| `docs/art/samples/client-046/queue-refresh-btn-pressed.jpg` | 1854 | 1600×900 DPR1 | queue | refresh-button-pressed |

## 缺口 / 说明

- 队列「建造+募兵同框」：本包分 `queue-build-rows` 与 `queue-recruit-row` 两张独立证据；未做单帧合成。
- 日常「领奖中」动效：以 `daily-after-claim`（state=4 已领奖）静态帧代替领奖点击瞬间。
- 复现：`cd client && npm install && npx playwright install chromium && node scripts/capture-client-046-evidence.mjs`
