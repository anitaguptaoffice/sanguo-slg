# ART-QUEUE-SPEEDUP-ICON-CONTRACT-001

Registration: #2507. Proposed independent host contract, not runtime acceptance.

## Scope and source

Reuse original production item 2003 from merged #2480; preserve every texture,
manifest, optional-loader and rollback rule in item-production-contract.md.
The host is only the existing build queue speedup button in QueuePanels.
No bag, shop, hero, mail, daily or generic button artwork is included.
No historical held implementation, reference image or new asset is introduced.

## Identity and unchanged behavior

The image identity comes from the existing BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID.
The queue renderer may mark that exact existing button with its item identity;
never derive identity from label text, position or another panel's button.
Only item.icon.2003.v1 with matching metadata ID and kind icon is acceptable.
Use AssetLoader's existing DPR-selected cache, not a guessed path or new fetch.
Missing loader, metadata, cached image or valid source leaves text unchanged.
Preserve the current button label, title, disabled state, focus and event behavior.
Artwork does not change cost, stock, duration, selection, command dispatch,
recovery, authorization or the existing consumptive action's meaning.
No click listener or item-use control is added by decoration.

## Visual host and lifecycle

One 20x20 CSS-pixel image with object-fit contain and at most 4px inline spacing.
The image has empty alt, aria-hidden=true and pointer-events:none; no tab stop.
The original text remains the accessible name and must remain fully readable.
Use local scoped style; do not modify shared panel geometry or held index.html.
If the combined content does not fit, preserve text visibility without clipping
or hiding the button, moving its focus target, or shrinking text to fit artwork.
Missing/error images disappear without broken glyphs or removing the label.
Skin-off hides decoration immediately; skin-on restores valid mounted icons,
including after a queue redraw while off. No RPC or fetch is added for toggling.
Each rerender/reskin has at most one image per existing button; do not accumulate
observers, timers or listeners on stale roots. Detached roots need no polling.
Unrelated primary buttons and skin state behavior must remain unchanged.

## Independent implementation and acceptance

Accept this document independently before merging dependent CLIENT work.
Existing production route: QueuePanels reskinPrimary calls MainCityScene's
skinCenterPrimary callback, which invokes skinPrimaryButtons with AssetLoader.
A narrow opt-in host hook can use this route without editing MainCityScene,
ContentPanels, index.html or any held #1973 file. Do not broaden it to generic
item-button support or other consumers in this component.
Register exact CLIENT paths/tests/docs separately, total <=400 changed lines.
No PNG, manifest, schema, backend, data, RPC or consumption changes in that card.
Review the complete shared-skin composition and regress unrelated buttons.
Unit tests must exercise actual QueuePanels redraw, original button identity,
disabled state/label, duplicate reskin, no assets, wrong ID/kind, image error,
skin changes, queue refresh/reopen and no automatic consumptive commands.

Separate official sandboxed Chromium QA must use actual main.ts/MainCityScene,
QueuePanels, AssetLoader and production PNGs with a controlled localhost peer.
At 1280x720 and 1600x900, DPR1/1.5/2, record text/image/button/ancestor clipping
bounds and screenshots for normal/disabled, skin off/on, off redraw, repeated
refresh and close/reopen. Exercise nonconsumptive keyboard/mouse navigation.
Do not click the enabled speedup command for art QA; prove zero mutation routes.
Check missing image/cache and DOM-image error fallbacks. Preserve all raw failures.
This frontend acceptance does not prove backend speedup or deployment.
Final source/composition, independent review, applicable tests and every required
CI gate must pass before normal merge. No local Chromium refusal retry.
Removing this decoration restores text-only buttons without gameplay changes.
Historical #1973, #77, #82, #108 and all other holds remain excluded.
