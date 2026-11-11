# CLIENT-RANK-PAGINATION-001

Task: https://github.com/anitaguptaoffice/sanguo-slg/issues/2005

## Behavior

Both existing player leaderboards can navigate previous/next pages of 20 rows and jump to the page containing the viewer's reported rank. First/last/current-viewer-page controls are disabled, as are controls during an active request. An unranked viewer cannot use the jump. Each board retains its latest successful page during the panel lifetime; reopening and hero-return scrolling reuse that page. Refresh acts on that page and retains the existing manual-refresh cooldown. Pagination itself is navigation, not a manual-refresh event.

A failed navigation keeps the displayed successful page and rows; Retry requests the failed target without starting or waiting for manual-refresh cooldown when the failure was navigation. A shrinking snapshot corrects an out-of-range page once; repeated shrink fails visibly and allows retry. Empty boards remain page1. Page navigation resets the actual table scroll. A snapshot-shrink correction discards return scroll belonging to the old page, while same-page hero returns retain their scroll. Top-three refresh decorations apply only to page1. Every response replaces the current page, never concatenating different snapshots. Snapshot versions remain visible; paging is not a frozen cross-request snapshot. Actor change/remount clears cached page positions. Existing battle-report power-rank highlighting still opens page1 because the protocol has no arbitrary-entity-rank lookup.

No new protocol, backend, ranking rules, world/hero commands, assets, or dependencies. Changes do not touch existing held client files. New implementation on main d632e8dbfee04cf4b1b5ad2e80a42bf7e61fab63.

## Verification

Run `cd client && npm test -- src/ui/SocialPanels.rankPagination.test.ts src/ui/SocialPanels.rankRead.test.ts src/ui/SocialPanels.test.ts`, then full `npm test` and `npm run build`.

Actual SocialPanels DOM events run with a mocked gateway in jsdom. Coverage includes rank21/viewer43, page boundaries, cache/failed navigation, retries, repeated clicks/reopen, board isolation/stale responses, current-page refresh/cooldown, shrinking snapshots, empty/unranked boards, and actor changes. These tests do not prove real browser layout or live gateway behavior.

## Acceptance hold

Keep Draft until independent final-tree review, full applicable tests/build, exact-head CI and real acceptance pass. Real browser1280/1600 keyboard/mouse, toolbar layout, scrolling and hero-return behavior, plus live gateway paging on both boards, must be checked. Live browser/server acceptance has NOT been run here. No deployment or historical hold release is implied.
