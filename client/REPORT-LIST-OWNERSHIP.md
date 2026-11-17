# Battle report list ownership

CLIENT-REPORT-LIST-OWNERSHIP-001 assigns a version to each refresh or pagination request, bound to the attached panel and gateway session. Refresh supersedes any older page/refresh; stale success, error and loading completion are ignored. Current pagination still appends at its requested offset, and duplicate pagination clicks remain blocked.

Only a successful, still-current open refresh can establish the unread baseline or continue a deep link. Closed/detached panels cannot continue an old open; a newer explicit detail selection is preserved. Failed opens preserve unread state and can be retried. Filtering and protocol contracts remain unchanged; already sent read requests are not canceled. Controlled UI tests cover these flows; no browser/deployment acceptance is claimed.
