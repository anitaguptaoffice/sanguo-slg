# ENGINE VERIFY — ART-ICONS-003

**Agent:** [bc-3b276a16-19ba-5def-82ff-acd5e501c78a](https://cursor.com/agents/bc-3b276a16-19ba-5def-82ff-acd5e501c78a)  
**Branch:** `verify/ART-ICONS-003-c78a`  
**Art source:** cherry-pick `02399f6` from `feat/ART-ICONS-003-hud-resources` (PR #144) — **not merged**  
**Base:** `origin/main` @ `5af4953`  
**Engineering / art final sign-off:** **PENDING**

## Checklist

| Item | Result | Notes |
|------|--------|-------|
| Three icons load from manifest paths | **PASS** | `res.icon.wood.v1` / `iron` / `stone` in `manifest.json`; runtime HUD row draws all four icons |
| DPR1 selects 1×, DPR2 selects 2× | **PASS** | See `verify-screenshots/dpr-probe.json`; HUD shows `art 1× @1.0dpr` / `art 2× @2.0dpr` |
| 32px readability / weight vs food / transparent border | **PASS** (engine) | Side-by-side HUD crop; no obvious matte box on dark bar — **art still PENDING** |
| `npm test` / `npm run build` (client) | **PASS** | 24 tests; `tsc` + `vite build` green |
| `dist` excludes reference / source / oversized art docs | **PASS** | No `reference/`, no `contact-sheet`, no `docs/art/samples` under `client/dist/` |

## Verify glue (VERIFY branch only)

Minimal `MainCityScene` HUD row: food + wood + iron + stone via `getImageForAsset` (same path as existing food icon).

## Screenshots

| Asset | Path |
|-------|------|
| Full HUD DPR1 | `verify-screenshots/hud-resources-dpr1.png` |
| Full HUD DPR2 | `verify-screenshots/hud-resources-dpr2.png` |
| HUD crop &lt;1MB DPR1 | `verify-screenshots/hud-resources-dpr1-hud-crop.jpg` (~305 KB) |
| HUD crop &lt;1MB DPR2 | `verify-screenshots/hud-resources-dpr2-hud-crop.jpg` (~358 KB) |
| DPR probe JSON | `verify-screenshots/dpr-probe.json` |

## Not merged

PRs **#144**, **#108**, **#100**, **#126**, **#140**, **#77**, **#82** were **not** merged for this verify run.
