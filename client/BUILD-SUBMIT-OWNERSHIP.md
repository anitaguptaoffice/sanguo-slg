# Building upgrade reply ownership

Task #2025, CLIENT-BUILD-SUBMIT-OWNERSHIP-001. Client-only repair; no protocol/backend change.

`StartBuildingUpgrade` returns the requested city's wallet/building. Previously the scene applied it to whichever session was current after awaiting: a city1 response could replace city2 wallet900 with5 and hallLv3 withLv2. Baseline actual-scene regressions failed before the fix.

A build command now owns its captured session object, actor primitives/token/generation, scene generation and request identity. Success, error and follow-up refresh UI effects require that owner. Enter/leave reset pending build UI; a new actor may submit while an old request remains unresolved, and old settlement cannot release the new request. Same-owner duplicate calls are ignored. Already submitted server commands are not canceled, undone or automatically retried.

The existing refresh pipeline accepts an optional ownership predicate for this command. It checks after each async boundary, including coordinate response application. Other callers retain their existing default behavior. This card does not fix other command handlers or claim server execution cancellation. Server state remains authoritative.

Acceptance uses actual MainCityScene methods with deferred gateway responses: actor/city/server/login/leave, overlapping generations, errors and valid settlement, pending duplicates, follow-up fetch/coordinate/minimap transitions. These are DOM integration tests, not live/browser acceptance. Full client test/build, independent final-tree review and exact-head CI remain required. No layout/new control changes.

Held #2000 shares this scene file. Its existing adjacent insertion conflict with #2024 at startMarch remains; this card changes building/refresh ownership, not its unit selection. Only that pre-existing adjacent insertion conflict occurred in a temporary combination tree; retaining both actor initialization and unitCfgId read passed 62 combination tests and build. This is not a clean auto-apply, does not change the held branch, and must be repeated when either component changes. Its live/browser hold remains independent.
