# ART-ITEM-PRODUCTION-CONTRACT-001

Status: proposed for independent review, not production acceptance.
Registration: https://github.com/anitaguptaoffice/sanguo-slg/issues/2476

## Scope and provenance

This independently reviewed contract covers only the 49 original item icons
2001–2049 in DATA-002. It does not approve or merge any historical held PR.
Input: candidate PR #1968, immutable commit
`91f3080ac50cc1abb961dac9f50e99c9266a2b6e`, under
`docs/art/samples/art-item-icons-001/`.
The INVENTORY.csv maps each numeric ID to its source code, source image hash
and both output hashes. Confirm all mappings against current generated cfg_item.sql
and the runtime item mapping before delivery. Names in the UI remain data-owned;
candidate artwork names must not overwrite runtime labels or change item effects.
Only independently validated original PNGs may be promoted in a separate ART card.
No reference extraction, candidate review page or historical hold bundle is copied.

## Texture and manifest contract

- Exactly 49 IDs: `item.icon.<item_cfg_id>.v1`, kind `icon`.
- Exactly 98 independent RGBA PNGs, no atlas, trim or frame animation.
- 1x 64×64 and 2x 128×128 are independently reduced from the same original master.
  Never enlarge 1x to produce 2x. Preserve the validated candidate pixels/hashes.
- Fully transparent outer padding at least 4px / 8px respectively.
- Production paths: `textures/{1x,2x}/items/<item_cfg_id>.png`, relative to
  `client/public/assets/art/v1/`; URL prefix `/assets/art/v1/` plus Vite BASE_URL.
- Metadata: display_size `{w:64,h:64}`, anchor `{x:32,y:32}`, anchor_unit `pixels`;
  variants scale 1 and 2 at the paths above; no crop_offset, nine_slice or states.
- Add entries to the existing maincity manifest without replacing its pack,
  base_url, schema version, other entries or required-image error behavior.
  The logical 64px metadata is not a claim that the bag displays at 64px.
- Existing loader selects 2x at DPR >=1.5, otherwise 1x. Each delivered variant
  must exist; no network or generated replacement fallback is introduced.

## Bag host contract

This scope is decorative imagery beside existing text, not a new inventory grid.
The bag name cell displays a 20×20 CSS-pixel image with object-fit contain.
ID, name, quantity, category, selection, keyboard and action behavior remain intact.
An image has empty alt and aria-hidden=true; text conveys item identity.
Unknown ID, absent loader/manifest entry/cache image, load error or skin-off
must retain usable text with no broken image glyph or startup failure.
The loader's optional exemption applies only to kind icon and
`^item\.icon\.[0-9]+\.v1$`; paths shared with a required asset stay required.
No other required image or manifest failure is swallowed by this contract.
Skin-off hides mounted icons. If the bag redraws while off, turning skin on
requires the next bag refresh/redraw to remount; immediate remount is not promised.

## Independent delivery and acceptance gates

1. Review and accept this document independently before dependent delivery.
2. Separate ART card: current schema validates the complete manifest; all existing
   entries remain structurally identical; validate exact 98 PNG hashes, dimensions,
   alpha borders, ID/code mapping and relative paths. Do not modify client code.
3. Separate CLIENT card: integrate with the real AssetLoader and complete host,
   not candidate-route injection; do not include PNGs in engineering scope.
4. On the final composed source, run applicable unit/type/build checks and all
   required CI; independently inspect actual 1280×720 and 1600×900 host screenshots
   at DPR 1, 1.5 and 2, skin on/off, mouse categories, keyboard selection/refresh,
   unknown/missing/error-image fallbacks, close/reopen and repeated refresh.
5. Record exact source, tree and final head identities and independent review.
   PR #2089's isolated mock proof is useful prior evidence, not this full-host PASS.
6. No production deployment, backend/data changes or historical hold release.

## Rollback and boundaries

Removing only these 49 manifest entries restores text-only item rendering;
other assets and gameplay must remain unchanged. Files can remain unused until
normal reviewed cleanup. Reverting optional host mounting also preserves text.
Do not remove the optional loader as an incidental rollback of this art batch.
Unit portraits, world terrain, new inventory frames and unrelated panels require
separate contracts; 48–64 world tile assumptions are not frozen by this document.
