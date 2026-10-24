# ART-ACTION-ICONS-011 client mount evidence

Art assets cherry-picked from Draft PR [#674](https://github.com/anitaguptaoffice/sanguo-slg/pull/674) @ `258c89a` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — **ask art for runtime visual sign-off** on the JPEGs below.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| `runtime/maincity-1600x900-full.jpg` | 1600×900 DPR1 — layout-frame clip, upgrade-farm icon visible |
| `runtime/maincity-3200x1800-full.jpg` | DPR2 equivalent (1600×900 logical) |
| `runtime/maincity-1280x720-full.jpg` | 1280×720 full viewport |

## Hit / mount proof

`runtime/hit-proof.json` — upgrade-farm button: label 「升级」, title/aria 「升级农田」, visible intersection ≥44px, edge hit probes.

Regenerate all: `cd client && node scripts/capture-art-action-icons-011-evidence.mjs`

Upgrade 1280 only: `cd client && node scripts/capture-art-action-icons-011-evidence.mjs --only-1280`
