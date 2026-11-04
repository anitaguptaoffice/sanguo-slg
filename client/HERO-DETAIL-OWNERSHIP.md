# Hero detail read ownership

CLIENT-HERO-DETAIL-OWNERSHIP-001 / #2027. Client-only, unchanged hero RPCs and layout.

Actual DOM reproduction: select hero7 then hero8; resolve8 first and7 last. Before repair the detail shows7 while the selected row and Upgrade request target8. Ten baseline read/lifecycle regressions failed before implementation.

Each detail/navigation intent now captures a monotonically increasing read generation and the current actor/token/session generation, mounted panel and visibility. Success, rejection and final loading cleanup require that intent and selected hero ID. Response hero_id must match the request; mismatches show a retryable error, never another hero. Starting a read removes the old detail. Close/toggle, detach and return-to-list invalidate pending reads.

Deep links reserve intent before waiting for the hero list, so an older navigation cannot take over a newer selection. List-selection restoration and removal of non-listed selections respect explicit selection made since the request began. Close/toggle/detach release the list lock and invalidate older reads; only the owning generation may clear a pending lock. Foreground intent also rejects presentation after switching panels, including away and back. Existing list-return folding is preserved; reopening a folded detail still requires selecting its row.

Scope excludes mutation settlement ownership: already-started upgrade/points/rest/training responses have separate pre-existing lifecycle risks. This repair guards detail reads and navigation only, does not cancel commands, and does not claim all hero command races resolved. Server remains authoritative.

Tests use actual HeroMailPanels DOM and production methods with deferred gateway responses, not real browser/server acceptance. Cover reverse completion, A→B→A, stale errors, actor/city/login changes, close/reopen/detach/back, response identity mismatch/retry, deep-link/list waits, and displayed hero versus Upgrade target. Full client/build, independent final-tree review and exact-head/main CI required.

Held #2004 modifies mail pagination in the same file. Exact held head adc2c9e56b2e1d1134f648e3d0d6b4f22f37f6ae was verified against its local source. Direct application conflicts at detach: this card invalidates detail reads while #2004 invalidates mail reads. Only in a temporary combination tree, both statements were retained; 81 final combined tests and build passed. This is not clean auto-apply; its branch/hold are unchanged, and future integration must retain both invalidations and repeat validation. No backend/protocol, data, CI, permissions or deployment changes.

Independent review found and verified fixes for reopen restoration, actionable old detail during deep-link wait, obsolete status/finally callbacks, actor lock release and valid non-listed deep links. Final runtime source6b305a7 passed52 independent tests (22 repository+30 reviewer). An intermediate full-suite process was killed and was not accepted; final full-suite validation uses two workers without excluding tests.
