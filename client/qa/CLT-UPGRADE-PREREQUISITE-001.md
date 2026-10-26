# CLT-UPGRADE-PREREQUISITE-001 — current hall prerequisite preview

Local card assigned by the orchestrator, 2026-10-25. Scope: `client/**`, ≤400 changed lines.
Frozen starting point: `799e1998d84610291b0bbcad7a108439f728ac7d`.

## Behavior and boundary

- Before submission, show the required/current hall level and disable an unaffordable or hall-blocked upgrade.
- Read-only rule reference: `internal/domestic/service.go`, `ValidateUpgrade` / `mainHallLvl`.
  Non-hall target ≤ current hall level; initial barracks needs hall 2, initial wall hall 3.
  Hall upgrades are exempt from their own-level cap; the existing other-building guard remains.
- In-progress hall upgrades do not count as completed levels. Existing city hydration/polling/refresh →
  `patchSession` → panel `sync` recomputes eligibility; activation also rereads the current session.
- Server errors, affordability, in-progress and submitting guards remain. No new RPC, cost/timer/config,
  backend validation, reference asset or frozen natural-QA changes.

## Verification

- `npm test -- --maxWorkers=2 src/ui/MainCityBuildingPanel.prerequisite.test.ts src/ui/MainCityBuildingPanel.test.ts src/ui/MainCityBuildingPanel.focus.test.ts`: 15/15 passed.
- `npm run build`: passed (existing large-chunk advisory only).
- Full suite: `npm test -- --maxWorkers=2`: 490 files / 2385 tests passed.
- `node client/qa/upgradePrerequisite.browser.mjs` from repository root starts its own local Vite.
  `QA_OUT` selects evidence output; optional `QA_URL` uses an already running Vite instead.
- Actual sandboxed headless_shell at 1280×720 and 1600×900: blocked affordable farm2→3/hall2;
  hall3 refresh clears warning; stale click sends no action; hall self-upgrade; Escape/reopen;
  visible prerequisite/button within panel and no horizontal overflow or browser errors.
- Browser evidence uses explicitly labeled deterministic component fixtures with production CSS/art/layout.
  It is not a native backend playthrough or evidence of accepted/debited/queued gameplay actions.
