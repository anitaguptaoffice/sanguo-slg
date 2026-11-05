# World-grid battle report target

CLIENT-WORLD-REPORT-TARGET-001, issue #2066. Existing read-only navigation repair; no new controls, assets, RPC or server changes.

A report loaded on a later offset page can lead to a world tile card. Returning through that card refreshes the report list from page one. Previously the absent hint fell back to the globally newest report, even from another grid. The fix retains a known same-grid hint from an accepted same-actor snapshot and requests that exact report once. A fresh list summary takes precedence over old coordinates; unavailable/forbidden details retain the server error.

The snapshot has actor provenance independent of request generation. Session-generation/server changes and remounts invalidate old cached hints. The target is never appended to the refreshed list, so pagination offsets and overlap detection remain unchanged. This does not provide snapshot pagination or solve records moving between offset pages.

Explicit matching hints preserve existing behavior even when outcome/time filters hide their list row. Remembered filters are unchanged. Unknown or contradictory hints fall back only within the visible grid/time/outcome result. Empty results clear unrelated prior detail and map replay. New filters, panel navigation or another report request during the list read prevent the old automatic handoff.

Validation uses mounted BattleReportPanel and WorldPanels with actual row/shortcut clicks and normal sequential reads: (20,0), (20,20), (20,0). Existing disclosure/layout remains unchanged. Additional tests cover cache provenance, preserved filters, pagination, authoritative errors and FIFO interrupted refreshes. Browser visual acceptance is not claimed; independent review must assess the applicability of further acceptance before merge.
