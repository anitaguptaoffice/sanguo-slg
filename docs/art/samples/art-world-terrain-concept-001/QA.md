# Static QA — 2026-11-05

Scope: three newly generated concept masters, not production terrain.

## Verified
- Decoded all three source PNGs with Pillow: 1254x1254, RGB, opaque. SHA256 and byte lengths are in INVENTORY.csv.
- Masters copied byte-for-byte from their built-in generation results; prompts preserved in README.md. No external reference images used.
- Visually inspected all full-size tool outputs and the local combined 280px / 64px contact sheet.
- Plain, mountain and water remain distinguishable by silhouette/material and palette at 64px. The plain is low relief; mountains have strong peaks; water is blue-jade with restrained ripples.
- No visible text, UI, borders, city/army/resource nodes or unrelated props in masters.
- Palette, painterly materials and upper-left light form a coherent concept set.

## Limitations and non-passes
- Mountain includes peripheral peaks crossing frame edges. This is acceptable for a full-bleed concept, NOT evidence of an untrimmed standalone sprite or valid seamless tile.
- Strong directional highlights, particularly the water's upper-left area, can repeat visibly. Opposite edges and terrain transitions have not been designed to join.
- Three independent compositions do not establish identical camera geometry, footprint, scale or production style approval.
- No production 1x/2x variants. No geometric tile-set montage pretending adjacency is solved.
- Preview produced locally with Pillow; no browser was launched and no host acceptance was performed.
- Independent review and exact-head CI must be recorded in the PR; this file does not claim them in advance.

Status: concept exploration delivered for review; production suitability unresolved pending the separate contract decisions.
