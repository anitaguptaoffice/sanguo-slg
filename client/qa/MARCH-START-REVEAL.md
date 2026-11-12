# QA-MARCH-START-REVEAL-001 (#2516)

## Frozen inputs and execution

Repair: `e3c848e4acdb10baef113c3df36b62f44cc86567`, tree
`0c41aa9a2e444e3af2f22fb540858291bdb68f76` (#2478).
Baseline: `b98b24b6833e06f1b3f965a4a77dedb2d876ae3f`, tree
`6de1bb51739046120841d8af1ba824739320c754`. MainCityScene is identical
between these inputs; MarchListPanel contains the repair under test.

The dedicated pull-request workflow checks out each exact input separately,
copies only this harness from the QA head, installs existing locked dependencies
with npm ci and official Playwright Chromium on the official Actions runner.
Run from that input's client directory with `QA_OUT=/absolute/output node
qa/marchStartReveal.browser.mjs`; baseline additionally requires `QA_BASELINE=1`.
No browser sandbox flags are disabled: launch requires chromiumSandbox:true.
Local socket EPERM is a blocker, not permission to bypass the sandbox.

## What this proves (only after actual execution)

At both 1280x720 and 1600x900, native input/click events exercise unmodified
MainCityScene.onMilitaryClick, startMarch, validation, syncMilitaryPanel and its
notifyMarchStarted handoff to production MarchListPanel, GatewayClient, protobuf
and index.html CSS. Initial read, exactly one StartMarch, and subsequent paged
ListMarches replies are FIFO checked, with decoded requests and route history.
The returned order does not fabricate a list row. Reveal waits for page two.

Repair matrix: stale Returning, manual destination and world destination filters;
compatible phase/destination plus ETA descending retention; missing-target later
refresh; failed read then refresh without repeated write; newer filter/selection;
close, close-away-back, peer navigation; city/session/mount invalidation; and
openPanel:false via navigation before StartMarch resolves. Baseline must reproduce
hidden new row under each stale filter despite the authoritative snapshot
containing it. It is an expected-failure witness, not a repair acceptance pass.

## Controlled fixture boundaries

The scene shell supplies a minimal military form and native navigation buttons,
an owned idle hero, ready troops, and a fake EventTarget WebSocket. Production
GatewayClient serializes requests and receives encoded server packets. Synthetic
server data supplies an indexed total of 21 with sparse rows across two pages.
The world selection callback is fixed at (90,91), not a mounted WorldPanels UI.
Production MarchListPanel creates its own DOM and listeners. Scene HUD rendering,
city-state cache clearing, arrival tracking, minimap polling and city refresh are
stubbed; this deliberately avoids unrelated concurrent readers. The full scene
attach/render loop, world navigation and server economy are not tested. Polling
is set to one hour; explicit native refresh drives recovery deterministically.
This is component/integration acceptance, not live backend, natural game lifecycle,
economy, deployment or production acceptance.

## Evidence and gates

Each matrix artifact includes report.json with target/tree/harness SHA-256,
viewport, case results, decoded requests, routes, errors and cleanup; pending and
settled PNGs; and Vite log. Zero page errors, drained FIFO, one StartMarch per case,
selected/recent row and geometric visibility assertions are required. Every
successful reveal must intersect the viewport and all overflow/paint-clipping
ancestors with at least 90% row width, 50% row area and min(row height, 32px)
visible height. Geometry records include row bounds, intersection, ancestor
bounds and scroll dimensions/positions, accounting for layout-frame scaling.
Settled screenshots and geometry are saved before this gate; the harness never
scrolls the row or modifies layout to satisfy it. Panels detach,
gateway closes, browser closes and Vite terminates. Failure exits nonzero and
writes a partial report; skipped/unexecuted cases are never PASS.

Independent source and artifact/screenshot review and applicable exact-head CI
remain required before either PR leaves Draft. Baseline/composition changes need
renewed review and affected tests. This QA adds no production source, dependencies,
permissions or secrets. Historical #77/#82/#108 holds remain excluded.

## Native review HOLD and regression gate

Independent screenshot review of the earlier harness found that missing-target
and failed-read recovery left row 9 clipped outside the list at both viewports,
despite its selected information card and Playwright isVisible() passing. Those
four settled screenshots and earlier reports remain failure evidence, not native
acceptance. The geometry gate above corrects this false-positive assertion.
The independently reviewed source correction is now pinned to the exact repair
commit/tree above. Native rerun and artifact/screenshot review remain pending;
previous green reports cannot clear this HOLD. jsdom logic smoke cannot
validate clipping or replace the native geometry/screenshot gate.
