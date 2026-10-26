# CLIENT-REPORT-TROOP-SCAN

The actual native `33-native-report1-losses-visible.png` and recorded-report
fixture show brown troop-summary body text over #221a14 (1.31:1 at11px).
`.battle-report-troop-scan` uses ivory on its existing dark surface with 14px/1.5
wrapping. Same-panel status text uses paper warning-brown only with an actually
applied paper fill; otherwise orange ink on an explicit dark fallback, also14px. No report data/text/actions,
protocol, PNG, other-panel styling, narrative or round-table declarations change.

Run focused/full client tests with maxWorkers=2, then build. Serial native fixture:
`QA_OUT=/tmp/report-troop-scan node qa/reportTroopScanReadability.browser.mjs`.
`QA_BASELINE=1` records old metrics before repair. Covers1280/1600, paper/art-off/
missing-image/missing-metadata, recorded data, round8/highlight, scrolling/reopen,
and audits visible same-panel text contrast with alpha-composited CSS surfaces.
Baseline audit also found the paper loaded-count `.report-panel-status` line
at1.73:1; this measured failure is included with explicit orchestrator authorization.
The final fixture requires no active text-contrast failures in this recorded panel.
These are recorded-data component fixtures, not live backend acceptance.
