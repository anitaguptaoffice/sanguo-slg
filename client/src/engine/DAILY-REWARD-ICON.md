# CLIENT-DAILY-REWARD-ICON-001

Registration #2498; independent host contract #2497, dependent merge gate.
Reuse production item icons from #2480 beside DailyQuestPanels reward text.
The existing reward resolver is exported unchanged and shared by text and image;
no extra reward table, guessed URL, RPC, identity or quantity change is introduced.
Image is decorative 20px, cache-selected DPI, with text-only absent/error fallback.
A panel-owned scoped stylesheet hides it while skin is off and restores it after
an off-state redraw. Old rows are discarded by the existing renderer; duplicate
mount removes the previous icon and the error handler is one-shot.

Coordinator permitted the shared DailyQuestPanels.ts boundary with blocked #2311:
only one import and one call after appendDailyQuestRowSecondary. No title/focus/
keyboard behavior is edited, and #2311 native acceptance remains its own task.
No #1973 file/source, PNG, spec, backend or deployment change is included.
Unit tests do not prove real-browser usability. Exact composed six viewport/DPR
host cases, fallbacks, screenshots, independent review and required CI remain gates.

Official first-run screenshot exposed the existing fixed 40px skin bar clipping
reward content. Coordinator authorized natural-height wrapping only for this
host reward row, including cache/error fallback; no title or interaction logic
is changed. Final multi-resolution image and text geometry still require QA.
