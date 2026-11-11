# QA-ITEM-FULL-HOST-001

Registration: #2482. This test composes immutable #1973, #2480 and #2485 (2f3bef2, including main 66c9c142) in a disposable
runner checkout, verifies tree 7bfbc70aab229d932c93c8f8d6d2e58e5bce65dc, and never
updates either branch or releases any hold. The original main.ts, MainCityScene,
Canvas, skin and AssetLoader run against production manifest/PNG paths.

Only the repository's local mock gateway is used, bound to 127.0.0.1. Its disposable
copy extends bag data to 49 items plus an unknown ID. No production server or
native backend is exercised. No main-module substitution occurs. Happy-path images are original production files.
Official locked Playwright installs Chromium, which launches with sandbox enabled.
No retry of the denied local browser or weaker security settings is involved.

Six viewport/DPR cases cover visible icons, actual source resolution, keyboard,
mouse, category switch, skin toggles, redraw, close/reopen and repeated refresh.
Screenshots and JSON/logs are retained on failure. Independent visual review is
required; assertions do not establish artwork usability or full game acceptance.
Unknown-ID text is asserted in each normal case. Three separate 1280px negative
controls abort one image request, remove one manifest entry, or give a mounted
DOM image a missing URL, then require text fallback and no broken image.
These deliberate fault injections are distinct from the six untouched asset runs.
No test success is claimed until the run finishes and evidence is reviewed.

The refreshed run scrolls every item 2001–2049 into the actual list viewport,
asserting 20px bounds, text and DPR path, and stores all 49 geometries per case.
This is reachability evidence, not independent per-item artwork readability review.
Earlier run 42994065043 remains evidence only for the prior frozen composition.
