# Confirmed persuasion inventory

CLIENT-PERSUADE-BAG-001 / #2080, based on main 397cc8728e5ef533d4ed2847649d94260cd45b18.

- `PlanPersuade` consumes item 2004 × 1. `PersuadeHero` confirms the action but supplies no inventory snapshot. Read `ListPlayerBag` after confirmation and replace the full bag, without local subtraction, gold changes, or `GetCityState`.
- Keep the named successful outcome separately from inventory/target read errors. Failed or superseded inventory reads show pending state and disable further persuasion. Existing “拉取结交目标” retries reads only, never a mutation. Equal full snapshots need no redundant session patch.
- Target selection and closing preserve confirmed settlement. Actor, city, gateway connection/session, session object, original mounted panel, and detach generation own the result. A newer asset epoch or replaced bag prevents stale overwrite and retains pending recovery.
- Befriend/hire retain `LionizeHero` behavior. Unknown mutation outcomes, backend changes, and historical holds are outside scope.

Validation: `npm test -- --maxWorkers=1 src/ui/HeroMailPanels.persuadeBag.test.ts src/ui/familySettlement.test.ts src/ui/HeroMailPanels.test.ts`; full `npm test -- --maxWorkers=2`; `npm run build`.
Tests mount actual panel controls, cover last/multiple scrolls, failed/superseded reads and retry, selection/close/re-entry, actor/session ownership, double clicks, and befriend/hire. One integration test uses the real `GatewayClient` packet/protobuf path with a controlled transport, not a live backend or browser.

The legacy cooldown-error fixture now returns one stable session object, matching production `MainCityScene.patchSession` (`Object.assign`); its existing error assertion is unchanged. Production submission ownership stays strict, including same-actor session replacement before confirmation.
