# ENGINE VERIFY — ART-ICONS-003

**Agent:** Cloud VERIFY (ART-ICONS-003 runtime layout fix)  
**Branch:** `cursor/verify-art-icons-003-c78a`  
**Art source:** cherry-pick `02399f6` from `feat/ART-ICONS-003-hud-resources` (PR #144) — **not merged**  
**Engineering / art final sign-off:** **PENDING**

## Runtime fixes (this pass)

| Issue | Fix |
|-------|-----|
| DOM HUD text overlapped canvas resource row | Main city HUD no longer prints 粮/木/铁/石 text; `#hud.hud-main-city` right-aligns city/gold/status so the left 520px is left to canvas icons |
| DPR2 stage ~¼ frame (toolbar full width) | `applyLayoutTransform` now uses `transform()` so it composes with `GameApp` DPR scale instead of `setTransform()` wiping it |
| HUD crops were full-screen | Capture uses `#layout-frame` panorama + page `clip` on the top 520×56 CSS px of the layout frame |

## Checklist

| Item | Result | Notes |
|------|--------|-------|
| Three icons load from manifest paths | **PASS** | `res.icon.wood.v1` / `iron` / `stone` (+ food) in manifest; HUD row on canvas |
| DPR1 selects 1×, DPR2 selects 2× | **PASS** | `verify-screenshots/dpr-probe.json` |
| Icons draw at 32 CSS px (1×/2× bitmap) | **PASS** | `drawImage(..., 32, 32)` in layout space; DPR2 backing 3200×1800 with 1600×900 CSS frame |
| No duplicate resource text overlap | **PASS** (engine) | DOM HUD excludes 粮木铁石 — **art PENDING** |
| DPR1/DPR2 stage fills layout frame | **PASS** (engine) | See viewport metadata — **art PENDING** |
| `npm test` / `npm run build` (client) | **PASS** | 25 tests; `tsc` + `vite build` green |
| `dist` excludes reference / source / oversized art docs | **PASS** | No `reference/`, no `docs/art/samples` under `client/dist/` |

## Viewport / backing (Playwright 1600×900 CSS)

Recorded in `verify-screenshots/viewport-metadata.json`.

| Shot | CSS viewport | Layout frame CSS | Canvas backing | `devicePixelRatio` |
|------|----------------|------------------|----------------|--------------------|
| `hud-resources-dpr1` | 1600×900 | 1600×900 | 1600×900 | 1 |
| `hud-resources-dpr2` | 1600×900 | 1600×900 | 3200×1800 | 2 |

HUD local crops: top **520×56 CSS px** of the layout frame (`hud-resources-dpr*-hud-crop.jpg`; DPR2 JPEG is 1040×112 device pixels for the same logical region).

## Screenshots

| Asset | Path |
|-------|------|
| Full layout DPR1 | `verify-screenshots/hud-resources-dpr1.png` (1600×900) |
| Full layout DPR2 | `verify-screenshots/hud-resources-dpr2.png` (3200×1800) |
| HUD crop DPR1 | `verify-screenshots/hud-resources-dpr1-hud-crop.jpg` (520×56) |
| HUD crop DPR2 | `verify-screenshots/hud-resources-dpr2-hud-crop.jpg` (1040×112) |
| DPR probe JSON | `verify-screenshots/dpr-probe.json` |
| Viewport metadata | `verify-screenshots/viewport-metadata.json` |

## Not merged

PRs **#144**, **#108**, **#100**, **#126**, **#140**, **#145**, **#77**, **#82** remain **unmerged** for this verify run.
