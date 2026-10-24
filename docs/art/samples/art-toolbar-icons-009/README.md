# ART-TOOLBAR-ICONS-009 client mount evidence

Art assets cherry-picked from Draft PR [#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) @ `b490824` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — runtime visual sign-off target.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| `runtime/maincity-1600x900-full.jpg` | 1600×900 DPR1 — new six + military + sample 007 icons |
| `runtime/maincity-3200x1800-full.jpg` | DPR2 equivalent (1600×900 logical) |
| `runtime/maincity-1280x720-new-six-visible.jpg` | 1280×720 after toolbar scroll — all six new entries fully visible |

## Hit / mount proof

`runtime/hit-proof.json` — per-action labels, icon src, ≥44px hit wrap, no icon/label overlap.

Regenerate: `cd client && node scripts/capture-art-toolbar-icons-009-evidence.mjs`
