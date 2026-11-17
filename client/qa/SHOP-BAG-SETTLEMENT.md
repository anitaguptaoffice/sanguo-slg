# Shop to Bag settlement native component acceptance

Task QA-SHOP-BAG-SETTLEMENT-001, issue #2514. Separate from repair #2474.
The workflow fixes target commit 6d21279dbfbc522b67a3a8b1e8d4b978e09b1002
and tree 58f042526a31e79dbf468a145b863165f0188293, copies only the QA script,
and installs official locked Playwright Chromium with sandbox enabled.

Production ContentPanels, GatewayClient, protobuf and CSS run in a native browser.
A controlled FIFO transport delays receipts to reproduce the race deterministically.
Native clicks cover a 10-gold purchase followed immediately by Bag, repeated refresh,
close, remount, actor change, rejection, unknown result and abandoned-loading recovery.
Both 1280x720 and 1600x900 must pass. Report includes target/tree/harness hash,
route order, zero page errors, cleanup and pending/settled screenshots per case.

This is component/browser fixture acceptance, not live backend atomicity, database
transactions, real economy purchases, or end-to-end progression. No production
service is contacted. Existing local Chromium startup EPERM is preserved separately;
this workflow does not disable the browser sandbox or alter security settings.
