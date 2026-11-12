# QA-QUEUE-SPEEDUP-ICON-001

Registration #2511, CLIENT #2508, independent contract #2507 / #2510.
Immutable candidate source 85185e8d1d399e86dae5dcae20c76c601738490b,
tree f0d9b40da03bafa01ba5d81b76892a51f7ef31f2, based on main e89520eb.
Publication/execution remain blocked until independent source and composition
review. Pin changes require renewed review and affected tests, not blind reruns.

This harness runs actual main.ts/MainCityScene/QueuePanels/AssetLoader and item
2003 production PNGs using locked Playwright Chromium with sandbox enabled on
official Ubuntu 22. No local browser retry, native economy or deployment claim.
A disposable copy of the repository mock uses existing queue-build fixtures.
A local file selects stock-present or stock-absent for each fresh session;
no mutating request seeds the fixture. Nothing changes production source/data.

Six viewport/DPR groups each exercise enabled and disabled controls, skin on,
off, off-redraw-on, keyboard refresh, Escape/reopen and three repeated refreshes.
Refresh requires an actual GetCityState route and replaced button DOM. All text
Ranges, image and button bounds are checked against viewport and every clipping
ancestor after scrolling; image identity, label/title/disabled, 20px size,
spacing, pointer behavior and non-focusability are asserted. Enabled speedup
buttons are never clicked. Missing PNG, absent manifest/cache entry and DOM image
error preserve text-only controls. Route logs, geometry, screenshots, source
head/tree and harness hash are preserved including failures. Entry boundary is
visible main toolbar. Read-only bag navigation loads real stock into the session
before opening the queue; every later route must match the explicit read allowlist, otherwise
acceptance fails. Earlier routes are retained separately for independent review.
Bounded TERM/KILL service cleanup and browser cleanup are recorded and asserted.

Independent raw artifact, pixels, geometry, route and cleanup review remains
mandatory. Syntax checks do not replace browser acceptance. Source full client
suite/type/build and all exact-head required CI must pass. Holds remain excluded.

## Preserved first run and observation correction

Run 43146975469 / job 130946958678 failed on disabled 1280x720 DPR1 after
successful off-redraw geometry: Playwright scrollIntoViewIfNeeded retained a node
while waiting for stability and QueuePanels' one-second render replaced it.
Artifact 13911603271 preserves report, logs and pixels, ZIP SHA256
f5915dee2977f5c7fe20da6c686b7c44caaeca86403ecae8106a8390852cf15e.
No geometry assertion or mutation gate failed; later groups were not completed.
Correction selects the current host, instant-scrolls it and measures every Range,
image, button and clipping ancestor in one synchronous evaluation with membership
checks. No retry, timer freeze, product change or relaxed geometry/route gate.
Partial current-case evidence is retained. Independent review precedes a new run.
