# Explicit owned-backend test guards

API-PG-OWNED-BACKEND-GUARD-001 (#3089) replaces three wrapper assertions with
explicit fatal branches before dereferencing the captured backend. This makes
the non-nil/PID proof visible to staticcheck while retaining the same testing.Fatal
behavior and owned-transport checks. No production path or test outcome changes.
Local PG17 ordinary/race covers admission panic, completion terminal faults and
return rollback panic; no branch, assertion or cleanup gate is removed.
