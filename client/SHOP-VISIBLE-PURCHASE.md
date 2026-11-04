# Visible shop purchase selection

CLIENT-SHOP-VISIBLE-PURCHASE-001, issue #2051. Client-only purchase target safety; no changes to SKU, payment or settlement contracts.

The currently wired devShopCatalog contains only resource offer1001. Switching the shop to an empty speedup/other category left the selected ID at1001 even though the select and list were empty. Affordability and Buy searched the full catalog and could purchase that hidden resource package.

Selection now stays within the visible loaded category, selecting its first offer when needed or clearing to zero. A shared visible-offer lookup drives affordability, price comparison and purchase validation. Loading/error views do not expose a purchasable stale offer, including synthetic dispatch. Ordinary successful refresh retains a valid visible choice. Returning to a populated category selects a valid offer. Existing busy/unknown-outcome safeguards, purchase receipt handling, bag/wallet reconciliation and server authority remain unchanged. Already submitted purchases are neither canceled nor replayed.

Mounted regression tests reproduce the actual single-offer catalog, empty categories, switching, explicit choice preservation, error/loading and direct-dispatch safeguards. Full tests/build and independent review are required. Held #1973 is evaluated only as a disposable combination; no icon changes or hold release. DOM/controller evidence is not native browser/live acceptance or deployment.
