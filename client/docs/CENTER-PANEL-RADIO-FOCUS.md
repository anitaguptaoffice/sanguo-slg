# Center-panel radio Tab boundaries

Authority: [CLIENT-CENTER-RADIO-TRAP-001 #2317](https://github.com/anitaguptaoffice/sanguo-slg/issues/2317). New standalone source on main `cbdd409b66f48942071f8b793494d5f4af14d6a9`; no shared overlay, gameplay or disclosure preference changes.

The center-panel trap now derives its boundaries from eligible radio-group stops instead of counting every sibling. Groups require the same nonempty name, actual form owner and tree root. Unnamed radios remain independent. Eligible radios exclude negative tab index, disabled controls/fieldsets, hidden/inert ancestors and closed disclosure bodies. Nonradio candidates and their relative order retain the existing helper behavior; this is not a general tabbability rewrite.

Recompute on each Tab and panel opening. A currently focused eligible radio is the current group exit, even if programmatically focused while unchecked. Otherwise use the eligible checked member. An entirely unchecked group falls back to its first member forward or last member backward. Never change `checked`, dispatch synthetic selection/change, or intercept Arrow keys. The first/last trap behavior and Escape/trigger restoration remain intact.

The mounted production regression loads actual HeroMailPanels detail and verifies real largess gold/item properties, disabled submit and original candidate tail. Baseline forward Tab is not canceled and reverse Tab focuses the unchecked item; the repair cancels forward escape and targets checked gold on reverse wrap. Fixture regressions cover dynamic selection, unchecked groups, forms/tree roots, independent names, hidden/disabled controls, direction and noninterception.

These tests use jsdom: they prove handler decisions, not native browser Tab traversal or Arrow selection. Native selection can invoke the existing largess change handler and rerender nodes; that separate behavior is not repaired or silently accepted here. Old run42462071179 did not archive radio checked/name/form/event properties, so its source/pixel interpretation is not retrospectively upgraded to property evidence.

Release gates: independent exact component/composition/object review, full client tests/build and required CI; separately registered actual-service native baseline/fixed property/event evidence; then the unchanged thirteen-case four-cell layout gate with full raw/pixel/DB/economy/cleanup audit. No natural-hour training, source/QA merge, deployment or historical hold release is implied by unit tests.
