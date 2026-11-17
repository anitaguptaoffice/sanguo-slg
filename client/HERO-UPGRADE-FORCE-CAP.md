# CLIENT-HERO-UPGRADE-FORCE-CAP-001

Task #2019 fixes the existing upgrade → rest flow. GetHeroDetail provides an explicit
march_force_max. UpgradeHero returns the new level/EXP/attributes but no stamina fields.
Previously merging a Lv2 response into Lv1 detail kept 24/24 and disabled rest, although
RestMarchForceOnce on the server would fill to 28 at the new level.

When the detail level advances, reuse heroMarchForceMaxFromLevel from heroDetailForce.ts
to replace the old-level cap. Do not copy the formula or grant any current stamina.
The existing helper matches internal/hero/march_force.go MarchForceMax: 20 + 4 * level,
capped at 100. UpgradeHeroOnce only changes hero level/stats; stamina is separate state.
Unknown current stays unknown. An older or duplicate same-level response preserves any newer
explicit cap from detail/rest. Authoritative detail/rest responses continue to replace it.

This is the existing M1 derived fallback, not a new protocol guarantee. If the server's
level-cap rule changes or adds modifiers, update the shared helper and its tests together;
an authoritative cap in UpgradeHero would require a separately authorized contract change.
No protocol/backend, held panel, balance/cap rule, new RPC or deployment changes here.

An actual HeroMailPanels DOM regression first failed on main at 24/24 after upgrade.
The repaired flow shows 24/28, permits the existing RestHero request, and accepts 28/28
from its response. Parameterized tests cover every level 2–20, spent/unknown stamina and
duplicate results. These are mocked-gateway integration tests, not browser/live gameplay.
Independent review, full client tests/build and exact-head CI remain PR gates.

Independent review found an initial !== condition could lower a fresher Lv3 cap when an
older Lv2 reply arrived. An actual-panel delayed-response regression proved it; refresh
only on a forward level transition now preserves the accepted higher cap. Broader
pre-existing response ownership/level replacement is outside this helper-only card.

The cap inference also requires a matching hero ID (or an absent old identity). A delayed
higher-level response for a different hero must not inflate the currently selected hero's
cap or enable unnecessary rest. A second real-panel red/green test covers that switch.
