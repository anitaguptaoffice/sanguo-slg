# CI-LIVE-QUEST-BROWSER-001

Card #2264. New QA implementation; exactly three `.github` files, <=400 changed lines.
The immutable product input is main `e2b60dda830d9b25f15fcfced4da4acc090a8f1c` plus the unchanged three-file delta of #2063 `304e6d2b709586500a53d0049419e5c4d9dd1160`, parent `d575a1df738e104dc63272844a7af53ae7fd53a1`.
Expected combined tree: `8d2bb9b655eaefa227a0af95f0cd32dc8aebee28`. No held ref is changed; no other candidate assets are included.

The two official ubuntu22.04 jobs each have a fresh PG17 database and Redis7. The real server applies DDL/world/shard, stops, receives the seven existing DATA-002 seed files, then restarts. The production client bundle, normal entry, real login/city/quest gateway and sandboxed Chromium are used. No mock server, response substitution, clock override, force click, DOM replacement or security change. The guard prevents local browser execution.

The test records only request route, selected quest ID, response code and listed IDs, never authentication payloads/tokens. Negative cases assert no selection mutation or PG quest-row changes, truthful prerequisite/claim rejection, zero quest reward receipts and unchanged bag, no cross-panel controls, and exact explicit commands. Successful acceptance of1001 is verified in PostgreSQL; no task reward/completion is fabricated. Keyboard focus, two viewport sizes and screenshot evidence require independent visual review before any UI hold decision.

Run only through the scoped pull-request workflow. Artifacts retain report.json, full-page screenshots and sanitized subprocess logs, including failures after job steps begin. The workflow creates a not-passed preflight manifest before checkout/build; script preflight errors also produce a failure report. Infrastructure failure before any step has only GitHub job evidence. A successful health endpoint is not the acceptance gate. Browser/server failures must remain failures; product defects require their own domain cards. No production deployment, durable military activation, historical hold release or merge is authorized by this QA.
