# Daily quest visible selection

CLIENT-DAILY-VISIBLE-SELECTION-001, issue #2047. Client-only follow-on; no quest, reward or asset contract changes.

A remembered claimable filter could show only daily training #1014 while selectedCfgId still pointed at completed default food quest #1012. Claim therefore sent a hidden ID that the server correctly rejected. Selection now stays on a visible row: retain the user's valid visible choice, otherwise choose a visible default or clear selection. Detail, navigation and single actions use that selection. Empty/error/loading views cannot submit stale hidden IDs; accept requires authoritative state1, claim state3. The server remains the final eligibility authority.

Explicit queue/HUD deep links deliberately reveal the intended target by switching an incompatible filter to All. Ordinary refresh preserves the current compatible filter and selection. Chain switches reconcile within the visible chain. After a claimed row leaves the claimable filter, selection advances to another visible reward or becomes empty. Async completion recomputes buttons instead of blindly enabling them. Existing batch order and asset settlement are unchanged.

Mounted regression tests cover remembered and live filters, empty/error/loading states, ordinary refresh, explicit focus/todo/center targets, chain switches, post-claim selection and completion-time button state. Eleven initial reproductions fail on base. Two existing accept-lifecycle fixtures now use acceptable state1 instead of already-claimable state3, preserving their ownership assertions. Full suite/build, independent final-tree review and exact-head/main CI are recorded in the PR. No native browser/live-server acceptance, deployment, or hold release is claimed.
