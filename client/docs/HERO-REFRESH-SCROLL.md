# Stable hero refresh scroll policy

Task: [CLIENT-HERO-REFRESH-SCROLL-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2329).
Dependency: approved #2323 / Draft #2324 source `2d1be8ee841e305cfd0f364dfe224b086c67932d`,
tree `40859b2a6dd504cb40b8fbece6d8145f754c8d64` (local equivalent `182869a95e094488cf81c6a0b63f98786c4864d7`).
This separate card changes only the portrait-positioning decision, not the existing bounded economy sync.

## Behavior

A successful guarded same-detail economy refresh keeps the user's current viewport.
The loaded-detail render calls the existing portrait helper only when `!synced`.
Both public refresh render checkpoints remain, including legitimate wallet, inventory, training-hour,
affordability, option, and button updates. No saved-scroll replay or focus restoration is introduced.
Explicit hero selection, new-detail completion, collapse/expansion, changed same-id detail/template,
and failed sync preflight retain full rendering and normal portrait positioning.
Hidden refresh remains inert; disconnected or missing targets remain safe. Generic clip helpers,
CSS, original #2323 tests, assets, server contracts, and held work are unchanged.

## Evidence and limits

The new mounted suite passes an asset fixture into the real production panel, which mounts busts.
It calls the real public refresh and real helper; no positioning implementation is replaced.
JSDOM geometry is explicitly synthetic: existing production scroll/clip nodes own the coordinates,
and target getters follow that owner's `scrollTop`, including targets remounted during navigation.
These checks establish policy, identity, selection, guards, and modeled clip behavior, not native pixels,
browser anchoring/clamping, pointer hit-testing, or natural-hour gameplay acceptance.

Test-only pre-fix freeze `a6aa45d4010e2480bbe79bb322d5dd9db60270df` keeps approved production unchanged:
13 tests, 10 failing / 3 passing. Stable refresh moves owner 1000/900/950 to 396 and clips controls;
explicit navigation still positions the portrait. The same tests pass with the single-call guard.
Hour checks retain either exact legacy idle text or approved reentry unknown-status text: the current
wire parser omits status. They preserve that text on refresh and test exact selected-hour gold thresholds.
The earlier controlled helper-intervention proof `71c15850` remains separate historical evidence.
Native #2328/run 42472736413 passed finite identity/focus only; its visible-scroll failure is not erased.

## Validation gates

Run `npm test -- --maxWorkers=2 src/ui/HeroMailPanels.refreshScroll.test.ts` for the focused regression.
Also run original detail-refresh, focus/radio, ownership/navigation, and training tests, then the complete
client suite (`npm test -- --maxWorkers=2`) and actual build (`npm run build`) on each frozen composition.
Independent source/composition review, exact remote mapping and required CI remain separate gates.
The independently registered native extension must prove visible clip/scroll continuity and real input,
then original radio and unchanged 13-case layout acceptance must pass. No QA scroll/focus repair,
merge, held release, or production action is authorized by these synthetic source results.
