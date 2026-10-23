# VERIFY ART-MILITARY-005 — runtime QA

| Field | Value |
|---|---|
| Art source PR | [#227](https://github.com/anitaguptaoffice/sanguo-slg/pull/227) |
| Art tip SHA | `81c484f61177a3164ff1558859cb5a69db0106ac` |
| Contract | [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) (frozen) |
| Verify branch | `verify/ART-MILITARY-005` |
| Mock gateway | `client/mock-server/server.mjs` |
| Capture script | `client/scripts/capture-art-military-005-verify.mjs` |

## Checklist

| # | Criterion | Result | Notes |
|---|---|---|---|
| 1 | Branch from latest `main`; art commit `81c484f` (manifest + 2 PNGs + docs) | **PASS** | Cherry-picked onto `verify/ART-MILITARY-005`; manifest now **15** asset IDs |
| 2 | Military right panel wired to `ui.panel.military.v1`; RPC/CancelMarch/main-city IDs untouched | **PASS** | `skinNineSlicePanel(..., "ui.panel.military.v1")` in `MainCityScene`; optional `assetId` on `skinNineSlicePanel` |
| 3a | Military open 1600×900 DPR1 / DPR2 | **PASS** | `screenshots/military-open-1600x900-dpr1.jpg`, `...-dpr2.jpg` |
| 3b | 1280×720 readability | **PASS** | `screenshots/military-open-1280x720-dpr1.jpg` |
| 3c | Right panel ~420×≥320, nine-slice corners | **PASS** | `*-right-panel-crop.png` (DPR1/DPR2); panel CSS `width: min(420px, 42%)`, stretch target 420×320 in skin call |
| 3d | Primary button normal/hover/pressed/disabled | **PASS** | Military panel `募兵` button; `btn-primary-*.png` |
| 3e | Close military → main city clickable | **PASS** | `maincity-after-military-close-click.jpg` (canvas `#game` click after toggle off) |
| 3f | Center queue/mail/daily/bag (default skin contract) | **PARTIAL** | Panels open/close OK (`center-panel-*.jpg`); **runtime still uses legacy CSS fill**, not `ui.panel.default.v1` border-image (pre-existing; out of ART-MILITARY-005 scope) |
| 4 | Static contract: PNG sizes, slice 24, paths | **PASS** | 320×200 / 640×400 RGBA; manifest `nine_slice` L/T/R/B=24; hashes in `QA.json` |
| 5 | No baked text/icons in military skin | **PASS** | Visual review + crop shots; DOM text from engineering only |
| 6 | Client unit tests | **PASS** | `npm test` in `client/` (124 tests) |

## Screenshot index (all artifacts ≤1MB)

Full-viewport captures stored as JPEG (mozjpeg) for size; crops/buttons remain PNG.

- `docs/art/samples/art-military-005/screenshots/`

## Known gaps / follow-ups

1. **Center content panels** (`content-panel`): contract says reuse `ui.panel.default.v1`; wiring not present on `main` — separate engineering task, not blocking military skin land.
2. **Art PR #227** remains **Draft**; do **not** merge #227, #108, #77, #82, or this VERIFY PR without orchestrator sign-off.
3. Static `review-montage.png` in art package is not a game capture (documented in art README).

## Engineering paste block (for PR #108)

```
ART-MILITARY-005 runtime VERIFY (branch verify/ART-MILITARY-005)
Art tip: 81c484f61177a3164ff1558859cb5a69db0106ac (#227)
Military panel: ui.panel.military.v1 @ 420×320 logical stretch — PASS (DPR1/2, 1280×720)
Nine-slice corners on right panel crop — PASS
Primary button states on military actions — PASS
Close panel / main city interaction — PASS
Center panels default nine_slice skin — NOT WIRED (legacy CSS; screenshots for panel UX only)
Recommendation: military assets + manifest entry look ready to land after art/orchestrator accept; merge art PR #227 then drop verify-only wiring commit or fold assetId param into mainline client.
```

## Asset land readiness

**Ready for human/orchestrator accept** on art pixels + manifest entry. VERIFY branch client diff is minimal (military `assetId` + button skin on military panel + capture script); safe to cherry-pick wiring after art merges.
