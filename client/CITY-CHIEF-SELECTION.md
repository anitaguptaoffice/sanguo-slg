# CLIENT-CITY-CHIEF-SELECTION-001

Task: https://github.com/anitaguptaoffice/sanguo-slg/issues/2009

The existing city-office dropdown cleared feedback without updating the appoint button. With a vacant office, choosing a hero therefore left appointment disabled. Background hero/march refreshes also reconstructed the options with the incumbent first, overriding a replacement the player had selected.

Selection changes now immediately update button state and remember explicit choice, including the empty placeholder. Before a user choice, the incumbent remains the default. Later data/phase refreshes preserve a valid explicit choice; removal clears it instead of silently choosing another hero. Marching heroes stay blocked and become eligible only when existing availability rules allow. Busy phases still disable selection and actions. Hidden-section data is rendered when the hall becomes visible again; a remounted section resets explicit-choice tracking. No automatic appointment, new control, layout, backend rule or protocol change.

## Verification

Run `cd client && npm test -- src/ui/MainCityCityOfficePanel.selection.test.ts src/net/cityChiefOffice.test.ts`, complete `npm test`, and `npm run build`.

Actual DOM events cover initial selection, immediate appointment with the intended hero ID, background refresh, explicit clearing, removed/marching heroes, busy states, hide/show, feedback clearing, existing clear-chief action and remount. These client tests do not claim real browser/live-server acceptance. Final independent review, all applicable tests/build and exact-head CI are required; preserve Draft if another acceptance gate is identified. No deployment or historical hold release.
