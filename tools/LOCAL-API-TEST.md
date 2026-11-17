# Local API acceptance

Task: #3065, PLATFORM-LOCAL-API-TEST-001. Requires Docker, Python3 and the repository Go toolchain.
Run from any directory; output must be a new directory outside the checkout:

```sh
python3 tools/local_api_test.py ordinary /tmp/sanguo-api-ordinary
python3 tools/local_api_test.py race /tmp/sanguo-api-race
```

The runner discovers every API root, partitions it exactly once across four
workers, and also runs all API child packages. `--jobs 1` provides a serial
comparison; up to eight workers are supported. Each worker gets its own database
in a uniquely named, loopback-only PostgreSQL17 container. The data directory uses
a maximum 2GiB tmpfs; PostgreSQL fsync, synchronous_commit and full_page_writes stay
at their defaults and are recorded. Allocate sufficient host RAM for Go workers
and this disposable database. No external database URL is used or modified.

The existing reviewed root inventory/verification functions are reused. Each
child package also has an exact discovered root inventory. Inherited GOFLAGS
are ignored to prevent hidden test selection.
The two explicitly owned-PG gates are enabled, so an unexpected skip fails the
run. Empty generated packages must report their expected no-test terminal;
this does not permit skipping a discovered test. Raw JSON, source identity, commands, PostgreSQL settings/logs, exits and total
time remain in the evidence directory. Test failures retain their original logs
and make the command fail. The uniquely owned container is removed afterward;
never use this runner for persistent data. SIGINT/SIGTERM kill owned test process
groups and clean the container; hard host interruption may require removal
of the exact container identified by its `sanguo.local-api-owned=true` label.

This is local testing only: no online workflow, branch protection, production
runtime, database contract or test assertion is changed. Memory-backed storage
reduces disposable test I/O; it is not evidence of host power-loss durability.

## Measured local baseline (2026-11-17)

On this checkout's API source, the original disk-backed serial package completed
in 1026.014s (the outer execution handle later reported143; the package logged
`ok`). Serial tmpfs took704.864s. The validated four-worker ordinary runner took
186.759s including discovery/setup and passed all321 roots plus child packages,
with the two explicit owned-PG tests enabled. These are measured local runs under
the available machine load, not a timing guarantee. SIGTERM cleanup was separately
verified in0.37s; missing/skipped discovered roots and inherited/persisted Go flags
have explicit rejection/override controls. Race-mode evidence is required before
accepting changes whose scope requires race testing.
