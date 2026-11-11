# ART-DAILY-REWARD-HOST-CONTRACT-001

Registration: #2496. Proposed independent daily-quest host contract.
This document does not accept a held bag implementation or claim runtime delivery.

## Independent scope

Reuse only the original production item icons delivered by #2480 and the existing
AssetLoader cache. The item-production contract retains its texture, provenance,
manifest, optional-loader and rollback rules. No new artwork, atlas or metadata.
The new host is DailyQuestPanels' existing daily reward text line, not inventory,
shop, mail, hero or generic quest panels. No bag file or held PR is transplanted.

## Identity and meaning

Use the same resolved reward object as the existing daily reward text formatter.
Do not parse labels or duplicate a new reward table. The current resolver prefers
positive snapshot reward_item_id and quantity, then existing DATA-002 cfg/code
fallbacks. Preserve those semantics; image mounting never changes reward values.
Known fallback rows are 1014/2003, 1032/2011 and 1033/2042. This does not create
quests or rewards. No reward, invalid/non-integral ID or an uncached asset means
text only. A valid asset must be item.icon.<resolved item ID>.v1, kind icon.

## Visual and accessibility host

One decorative 20x20 CSS-pixel image, object-fit contain, beside the unchanged
reward text; preserve its wrapping and reserve at most 4px extra inline spacing.
Use the already selected DPR cache (2x at DPR >=1.5), with no guessed file URL.
Image alt is empty and aria-hidden=true. Text remains the accessible identity.
Images receive no focus, click action, item-use action or reward-claim behavior.
Rendering must not alter quest selection, progress, filter, keyboard or claim RPCs.
No loader/cache, missing asset or image error leaves text with no broken glyph.
Skin-off hides the decoration immediately. Turning it back on restores valid
mounted decoration, including after a redraw while off; no fetch or RPC is added.
Repeated refresh/reopen must not duplicate images or persist listeners per old row.
Local scoped style may be installed with this panel; do not edit held index.html.
The existing fixed-height skin bar must not clip the title or reward. Within only
this reward host, allow natural-height wrapping, also with a missing/error image.
This is a scoped layout fix, not a title-text, focus, keyboard or action change.

## Separate implementation and evidence

Accept this contract by independent review before dependent implementation merge.
A separate CLIENT issue/PR owns only the daily helper, reward formatter export,
DailyQuestPanels callsite and focused tests/docs. No PNGs, server, spec, gameplay,
new RPCs, reference artwork, held branch edits or production deployment.
Keep the existing reward resolver as the single source; exposing it is not a
license to change fallback or numeric validation semantics of the text formatter.
Any ambiguity or same-file concurrent task stops that overlapping change.

Unit cases cover known snapshot and fallback identity, absent/unknown/fractional
ID, absent loader/cache, error removal, duplicate prevention and skin transitions.
Use actual main.ts/MainCityScene/AssetLoader plus production PNGs on a local mock
service, distinct from native backend acceptance. At 1280x720 and 1600x900 with
DPR 1/1.5/2 verify reward text and icon bounds, category/filter/keyboard controls,
skin off/on and redraw, close/reopen, missing image/cache and unchanged claim
behavior. Preserve screenshots, reports, exact source trees and independent review.
All applicable tests and required CI must pass before normal permitted merge.
Removing this host returns unchanged text-only rewards; #1973 and every historical
reference/art/VERIFY hold remain untouched and unmerged.
