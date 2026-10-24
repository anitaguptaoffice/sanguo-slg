# ART-ACTION-ICONS-010 client mount evidence

Art assets cherry-picked from Draft PR [#649](https://github.com/anitaguptaoffice/sanguo-slg/pull/649) @ `7c401f7` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — runtime visual sign-off target.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| `runtime/maincity-1600x900-full.jpg` | 1600×900 DPR1 — layout-frame clip, refresh icon visible |
| `runtime/maincity-3200x1800-full.jpg` | DPR2 equivalent (1600×900 logical) |
| `runtime/maincity-1280x720-full.jpg` | 1280×720 full viewport |

## Hit / mount proof

`runtime/hit-proof.json` — refresh button: label 「刷新」, title/aria 「刷新状态」, visible intersection ≥44px, edge hit probes.

Regenerate all: `cd client && node scripts/capture-art-action-icons-010-evidence.mjs`

Refresh 1280 only: `cd client && node scripts/capture-art-action-icons-010-evidence.mjs --only-1280`
