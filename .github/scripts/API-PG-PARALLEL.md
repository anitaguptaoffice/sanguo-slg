# Complete API PG parallel execution

CI-PG-PARALLEL-001 retains both existing `api-pg-test (ordinary/race)` checks,
all triggers/permissions, isolated preflight and the frozen scenario inventory.
No tests or historical failure records are removed. No path-based skipping is added.

The runner discovers all root tests/examples/fuzz seeds with the same Go/race mode,
sorts names and distributes them round-robin over four separate Go processes.
Each owns a separate disposable PostgreSQL17 cluster and database. Reuse the
verified service image ID, bind only loopback ports 15432–15435, wait for readiness
and remove owned containers even after failure. This isolates cluster-wide
`pg_locks` and `pg_stat_activity` witnesses in existing tests, not just table data.
All descendants of each
selected root run, including future tests such as the #2395 origin regressions.
A fifth command runs every descendant API package without a test-name filter,
on the original service after preflight, in its own database on port 5432.
At most four commands run simultaneously; all exits are collected, without retry.
No `t.Parallel`, fixture or production-source changes are needed.

Every root shard must have precisely its assigned roots, one run/pass per test,
no skip/fail/unfinished/out-of-shard outcome and exactly one successful package
terminal. The unchanged frozen full gate then audits concatenated original JSON;
only its expected root package terminals change from one to four. No synthetic
PASS events, removed terminal records or rewritten output are used. The complete
inventory, commands, per-process and combined raw logs survive failure as artifacts.

Baseline main 312a579 API run [42599387667](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42599387667):
ordinary job 14m18s, race 18m27s; full/preflight steps 13m40s and 17m50s.
Earlier retained ordinary raw evidence measured 863.9s root work, 751.2s in 58
SmokePath roots. Round-robin replay predicts 206.3–224.7s per shard, about 74%
less serial test wall time before shared CPU/DB contention and setup. This is an
estimate, not a live benchmark. Exact-head official runs must establish actual gains.

Full coverage still runs on every PR and main push. Classification/path filtering
is deferred until dependency effects and required-check behavior are independently
proved. Protection inspection is integration-restricted; no protection is changed.
Controls: `python3 -m unittest discover -s .github/scripts -p test_api_pg_parallel.py -v`.
