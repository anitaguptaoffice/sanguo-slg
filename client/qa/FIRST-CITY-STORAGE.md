# Native first-city storage acceptance

QA-FIRST-CITY-STORAGE-001 (#2504) verifies the frozen CLIENT-FIRST-CITY-JOURNAL-001 (#2503) dependency.
The normal stacked PR checkout is the tested tree; no source replacement or generated production hooks.
Official Ubuntu CI uses locked Playwright and sandboxed Chromium. Local browser execution is not authorized.
The consumer imports production GatewayClient through Vite; native Storage/WebSocket are used.
The localhost peer supplies controlled protobuf observations, not real V2 authority, game UI, PG, or deployment acceptance.
Successful Storage instrumentation calls through native methods; only named failure cases inject faults.
Reports retain exact checkout/parents/tree, source hashes, versions, every case, safe protocol/storage evidence, trace and cleanup.
Auth uses only synthetic placeholders. Evidence must never contain real credentials or user information.
Complete browser erasure followed by a new instance cannot prove prior history; absence is never server EMPTY or execution authority.
Run `node qa/firstCityStorage.browser.mjs` only through the registered official workflow. Syntax checks are not native PASS.
