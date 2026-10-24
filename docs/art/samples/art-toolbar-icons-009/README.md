# ART-TOOLBAR-ICONS-009 client mount evidence

Art assets cherry-picked from Draft PR [#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) @ `b490824` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — runtime visual sign-off target.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| `runtime/maincity-1600x900-full.jpg` | 1600×900 DPR1 — new six + military + sample 007 icons |
| `runtime/maincity-3200x1800-full.jpg` | DPR2 equivalent (1600×900 logical) |
| `runtime/maincity-1280x720-new-six-visible.jpg` | 1280×720 — six new entries on first screen (scrollLeft=0) |

## Hit / mount proof

`runtime/hit-proof.json` — per-action labels, icon src, visible intersection ≥44px, edge hit probes, ≥44px hit wrap.

Regenerate all: `cd client && node scripts/capture-art-toolbar-icons-009-evidence.mjs`

Refresh 1280 only: `cd client && node scripts/capture-art-toolbar-icons-009-evidence.mjs --only-1280`
