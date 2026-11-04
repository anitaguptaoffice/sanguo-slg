# Battle report detail ownership

CLIENT-REPORT-DETAIL-OWNERSHIP-001 binds each detail read to the latest request, selected report, attached panel and gateway session. Late success or failure cannot replace current details, loading state, status, round navigation or detail links. Request versions also distinguish A → B → A and same-report retries. Detach invalidates pending detail reads; already submitted requests are not canceled.

The normal current detail and retry flow is unchanged. List refresh/pagination and delayed deep-link list continuations are outside this card. Tests use controlled deferred replies through real panel click handlers; no production deployment or visual/browser acceptance is claimed.
