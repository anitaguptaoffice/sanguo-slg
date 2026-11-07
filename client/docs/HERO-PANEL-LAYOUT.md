# Expanded hero panel layout

CLIENT-HERO-PANEL-LAYOUT-001, [card #2273](https://github.com/anitaguptaoffice/sanguo-slg/issues/2273), is a CSS-only repair. Base main is `757e43a9f40d7c92ded6a536ec334de94d69ff6f`, tree `cb3162ade8e15a9ab361b8f2d54ced1f5ea36d40`. No RPC, training, asset, native disclosure state or navigation logic changes.

## Real regression evidence

Independent [diagnostic #2272](https://github.com/anitaguptaoffice/sanguo-slg/pull/2272), [official run 42407758890](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42407758890), tested the actual gateway, isolated PostgreSQL and Chromium. Its product was `a020369eb4f58e835522934c662ab1fd3d4161e3`, tree `16fb9da5b53af34d75cae9cbbd21a8e39f1dcfed` (#2267 plus main757). The relevant CSS and panel structure match this base.

- At 1280x720, default-expanded hero-scroll started at y744 with height64, below the panel's outer bottom675.2; the primary name started at y824.75.
- At 1600x900, hero-scroll started at y1025.59 with height0, below outer bottom844; the name started at y1106.34.
- Both native row-center trials timed out. At1280 a later sample hit secondary text, not the clipped name; that is not successful default-expanded name input.
- Manually folding existing disclosures, normally scrolling and clicking the name recovered GetHeroDetail0. This diagnostic workaround does not satisfy the product's default-expanded acceptance. Outer bounds above are not the precise padding-box clip edge.

## Layout contract

The bounded hero panel previously prevented every non-roster flex child from shrinking. Expanded recruitment and capture content could therefore consume all of its height. Recruitment now caps at30% and capture at22% of panel content height; both can shrink and scroll independently. Roster/detail keeps a40% nonshrinking flex basis and grows into unused space, including after disclosures close. Header controls retain their normal size. These ratios are a CSS budget, not measured browser acceptance.

The old narrow400px detail minimum is removed because it could push content through the hidden panel boundary. The roster remains its existing vertical scroller. Expanded narrow capture bodies use normal flow inside the capture scroller rather than absolute popups that escape or are clipped by it. Controls, errors, native summaries and their keyboard semantics stay in the DOM; no new hidden state, auto-collapse or command is introduced.

Current production JS still closes recruitment on detail load and initially folds capture details on narrow attachment. This repair does not change those behaviors. Manual preference persistence across later data refresh is separate held #2065 work, not delivered here. Temporary compatibility checks must not update or release that held ref.

## Verification and remaining gates

Run `npm test -- src/ui/heroPanelLayout.test.ts`, the existing hero host/scroll/contrast tests, full `npm test`, and `npm run build`. The new tests mount the production panel with its full stylesheet, inspect computed CSS contracts for wide/narrow and detail-present/absent states, and retain controls/disclosures without sending commands. Before the CSS fix, five of eight assertions failed; three existing behavior controls passed. JSDOM does not implement layout, native scrolling, input hit-testing or visual acceptance.

Before merge: independent exact-source review, exact #2267 and relevant held temporary-combination review/tests, all required final-head CI, and separate official real-service Chromium acceptance are mandatory. At1280x720/1600x900 verify positive usable roster area within the true panel clip; default-expanded primary-name mouse input; actual wheel and keyboard/focus access to recruit/capture controls; expanded/collapsed/reopened states; recruit result and detail; refresh/Escape/reopen; bottom-toolbar clearance and screenshots. Do not use force, JS clicks, DOM layout rewriting or extra automatic folding to make the check pass. Frozen #2269 failure remains failure evidence. No merge, deployment, full-game acceptance or historical hold release is claimed by this source change.
