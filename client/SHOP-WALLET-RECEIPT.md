# CLIENT-SHOP-WALLET-RECEIPT-001

Issue #2037. Production PurchaseShopOffer returns a full wallet_after from the successful transaction result (shop_handlers.go and resourceWalletToProto in m4_convert.go include Gold). Previously the client used it only for a pulse; later GetCityState can refresh only four city resources, leaving confirmed purchase gold unchanged.

Capture the pre-dispatch asset epoch and wallet/bag object references. A successful receipt is applied exactly once only for the current actor-owned, mounted shop context with unchanged epoch/references. Freshness is checked before invalidating settlement reads; the current receipt then replaces the wallet rather than subtracting costs, including an authoritative gold=0. No granted-item delta is added; the existing owned bag/city/shelf reload remains responsible for inventory and supported read state.

Hiding the shop does not cancel its accepted result: a still-fresh wallet receipt updates that actor's balance, but never reopens a panel or starts hidden recovery reads. A failed later reload retains the confirmed wallet and success outcome; reload retries reads only. Detach, actor change, intervening asset reads or changed wallet/bag references prevent stale receipt application. Missing wallet_after never triggers a fabricated deduction.

This is NOT a solution for gold reconciliation after unknown or superseded outcomes. Their existing unknown/reload/new-purchase semantics remain, and city reads still cannot establish actual gold changes. No command is retried or automatically repeated, no backend/protocol/fee behavior changed.

Regression-first: four production-wire mounted purchase cases failed on main 42c3ec274e4516085e9db36a493f204a911437f7 while the prior 25 tests passed. Coverage includes gold 90 and true 0, read failure, hidden settlement, actor/relogin/detach and asset/ref replacement, later stale reads, and missing receipt. Final test/review/CI mapping is in the PR. Native browser/live backend not run; no production acceptance or held #1973 release. Temporary #1973 icon combination is verified without modifying its draft.

## Verified delivery

Runtime source 23d2bb503bee98ffecd85851288552b9634b6965 received independent PASS: reviewer reproduced the four failing baseline cases, ran 103 focused tests plus six extra reentrancy/ownership probes, and passed build/typecheck. Complete client suite: 542 files / 3135 tests passed (`npm test -- --maxWorkers=2`, no exclusions); build passed with the existing chunk-size advisory. Temporary exact #1973 held-head combination applied cleanly and passed 144 tests/build. Final documentation clarifies that freshness is evaluated before settlement invalidation and receipt application follows it; runtime is unchanged. Final source/tree/head/CI mapping remains in the PR.
