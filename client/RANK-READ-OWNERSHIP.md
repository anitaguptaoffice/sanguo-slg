# Leaderboard read ownership

CLIENT-RANK-READ-OWNERSHIP-001 coalesces only the active same-board/same-actor read. Switching boards starts an independent request and immediately replaces actionable old-board rows with that board's own cached/empty view. Versions distinguish A → B → A; both leaderboard and hero-ID await stages check board, actor and mounted panel before writes. Old errors/finalizers cannot stop a newer loading indicator.

Snapshots belong to their actor and are discarded on actor change or remount. Current failures retain the current board's own cache; manual-refresh cooldown and counts are unchanged. Stale open scroll/highlight continuations are ignored. Already issued requests are not canceled. Controlled DOM regressions and existing social tests cover the flow; no browser/deployment acceptance is claimed.
