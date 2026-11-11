# QA-ITEM-FULL-HOST-001

Registration: #2482. This test composes immutable #1973 and #2480 in a disposable
runner checkout, verifies tree ef563a5746ec7b8b529030656f73d2660658921a, and never
updates either branch or releases any hold. The original main.ts, MainCityScene,
Canvas, skin and AssetLoader run against production manifest/PNG paths.

Only the repository's local mock gateway is used, bound to 127.0.0.1. Its disposable
copy extends bag data to 49 items plus an unknown ID. No production server or
native backend is exercised. No main-module or image substitution occurs.
Official locked Playwright installs Chromium, which launches with sandbox enabled.
No retry of the denied local browser or weaker security settings is involved.

Six viewport/DPR cases cover visible icons, actual source resolution, keyboard,
mouse, category switch, skin toggles, redraw, close/reopen and repeated refresh.
Screenshots and JSON/logs are retained on failure. Independent visual review is
required; assertions do not establish artwork usability or full game acceptance.
Unknown/missing/error images also require separate explicit evidence; existing
unit tests cover fallback but do not substitute for browser acceptance.
No test success is claimed until the run finishes and evidence is reviewed.
