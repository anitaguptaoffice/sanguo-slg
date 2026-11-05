# Military entry roster refresh

Task CLIENT-MILITARY-HERO-ENTRY-001, issue #2070. Base `bf8fde66da040a672eb45dee67764805bd9d6bdc`.

## Player path and repair

After first recruitment, HeroMailPanels refreshes its own roster. MainCityScene has a separate march-form roster, initially empty. Previously only initial scene entry and the bottom military toolbar refreshed it. World-city selection, minimap target selection, daily training navigation, march queue banner, intel remarch, recruit queue return and HUD military navigation opened the form with the old roster, preventing the player from selecting their new hero.

These seven existing entry paths now use one local opener that opens the panel and invokes the existing roster read. Toolbar behavior remains unchanged. The read is single-flight, keeps an existing valid selection, retains known roster on failure, and checks actor/session generation and scene lifetime. No new polling is added to frame/render synchronization. Late reads update data only, never reopen a panel. Existing target, troop count, unit and local march-busy bindings are preserved.

## Authority and limits

The existing ListPlayerHeroes RPC supplies hero identity, template, level and loyalty. The actual server handler does not encode status, so this repair does not infer a fresh idle state, discard local busy bindings or invent availability. StartMarch remains authoritative. Existing first-page defaults (50 heroes) are unchanged. No recruit/march command is submitted, retried or canceled by opening a panel; previously submitted server operations cannot be canceled here.

## Verification

`npm test -- --maxWorkers=2 src/scenes/militaryHeroEntry.test.ts`

Fourteen cases include the mounted production MainCityScene, actual recruitment button and WorldPanels city-row click, all seven entry families, toolbar controls, pending-read coalescing, failure/read-only retry, selection/coordinate/count preservation, hidden-panel behavior, actor changes and scene exit. On unchanged base: 10 failures / 4 passing controls. With repair: 14 pass. These use gateway doubles with sequential authoritative responses, not reversed server command execution. They are not live-server/browser acceptance.

Run the full client suite and `npm run build` on the final tree. Independently review and test the temporary combination with held #2000 because both touch MainCityScene; never alter or merge the held branch. Exact review/tree/CI evidence is recorded in the PR. This is an existing-entry data-refresh correction with no new layout, controls, economy or protocol.
