# Hero upgrade potential

Task CLIENT-HERO-UPGRADE-POTENTIAL-001 / #2013. Client helpers only; no protocol, economy, cap or backend changes.

The current server budget is one potential point per hero level (`internal/hero/points.go`). Upgrade preserves allocated force/intel/politics adds (`internal/hero/upgrade.go`). UpgradeHero and GetHeroDetail do not return potential allocation fields, so the client must retain the known allocation result while accounting for the changed level.

- Applying an upgrade adjusts known remaining potential by the level-budget difference, leaving allocations and authoritative returned attributes intact. Unknown remaining values stay unknown; existing fallback behavior remains.
- Session-only point snapshots now retain the level associated with their balance. Merging into a newer detail applies only that budget delta, then the existing panel persists the newly anchored snapshot. Repeated reloads do not duplicate points; an intervening AddHeroPoint response becomes the new authoritative balance.
- Legacy snapshots without a level keep their previous balance unchanged. This does not reconstruct allocations absent from the existing detail protocol after a new session, nor solve concurrent external changes; those remain separate contract/ownership work.

Two red-first tests reproduced exhausted heroes staying disabled immediately after upgrade and after reopening detail. Actual HeroMailPanels DOM integration verifies spend→upgrade→spend→reopen, repeated upgrades/reloads and unspent balance, with existing gateway methods mocked. Helper tests cover unknown/legacy snapshots, allocation retention and non-negative balances; existing upgrade/point and panel suites retain cap, busy and action behavior. These are not live-server or real-browser acceptance. No visual controls are added or restyled; held HeroMailPanels.ts is unchanged.
