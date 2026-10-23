# ART-TOOLBAR-ICONS-007 client mount evidence

Art assets cherry-picked from Draft PR #481 @ `9f06e38` (**not merged**).

## Full viewports (JPEG, each <1MB)

| File | Description |
|------|-------------|
| `maincity-1600x900-full.jpg` | 1600×900 DPR1 full `#layout-frame` |
| `maincity-3200x1800-full.jpg` | 1600×900 viewport, DPR2 (3200×1800 capture) |
| `maincity-1280x720-toolbar-scrolled.jpg` | 1280×720 after horizontal scroll (icon batch visible) |

## States

- `states/ui.icon.toolbar.military.v1-normal.jpg`
- `states/ui.icon.toolbar.military.v1-disabled.jpg`

## Hit / mount proof

`hit-proof.json` — per-action icon src, 2-char labels, ≥44 CSS hit wrap, icon+label inside button & visible crop, no icon/label overlap.

Regenerate: `cd client && node scripts/capture-art-toolbar-icons-007-evidence.mjs`
