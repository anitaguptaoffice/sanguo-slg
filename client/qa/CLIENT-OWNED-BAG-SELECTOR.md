# CLIENT-OWNED-BAG-SELECTOR

- Root-assigned client-only repair from `2faa27f9eb437213f0e5bfc2dd7db4b705732bd2`.
- Cause: inventory rows were display-only, while the native select exposed only 2001/2003/2020; earned 2002/2007 could not be selected without a deep link.
- The native selector now combines owned IDs, original defaults and current selection, showing name/stock. Refresh/use updates the options but keeps the current target, including zero stock; unselected removed stock disappears. Category filtering does not hide owned choices.
- Missing DATA-002 names mirror readonly canonical `internal/content/seed/catalog.json`; established labels stay unchanged. Drift tests cover every new fallback name. No server/catalog/ID/protocol/cost change.
- Existing capability guidance, disabled unsupported/unknown use, hero-return, actor ownership, uncertain-result recovery and in-flight deduplication remain. Bag-only single-use validation also rejects a count greater than stock; dedicated hero validation is unchanged.
- Unit coverage: native select change events, 2007×1/2002×2 exact IDs/counts, batch slots, removed stock, invalid counts, unsupported/unknown, hero return and selection changes while pending or changing actors.
- Browser reproduction: `QA_OUT=/tmp/owned-bag-selector-browser node client/qa/ownedBagSelector.browser.mjs` from repo root. Sandboxed Chromium loads actual ContentPanels and production CSS at 1280×720 and 1600×900; selection uses native `selectOption`, never option injection/private setters.
- Browser boundary: isolated deterministic gateway fixtures only, **not** native gameplay/backend acceptance. It does not connect to or mutate any native Go/PG state. Reports/screenshots go outside the repository; browser and owned Vite are closed after the run.
- Validation: `cd client && npm run build && npm test -- --maxWorkers=2`; focused tests are `ContentPanels.bagSelection`, `ContentPanels.bagSafety`, `ContentPanels.bagAsync`, and `contentFormat` (50 assertions/tests).
