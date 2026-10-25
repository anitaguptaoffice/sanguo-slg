# Guild chat channel isolation

GUILD-REPAIR-001 (#1716) fixes the wrapper used by the production M3 wiring.
Previously the wrapper allocated guild channel IDs from a separate in-memory
counter, colliding with the inner store's world/private IDs. Messages are keyed
by server/channel, so this mixed chat histories even though membership checks ran.

- PostgreSQL wrappers now resolve the durable `chat_channel` guild row. Unique
  channel/guild conflicts during concurrent allocation are resolved by retrying;
  allocation is bounded to 16 attempts and returns an explicit retryable error
  on sustained contention. Query errors are returned rather than treated as
  missing channels.
- The known in-memory store allocates world/private IDs upwards from 1. Its guild
  wrapper uses negative positive-guild IDs, deterministic across wrapper rebuilds
  and disjoint from world/private keys. These IDs are not written to PostgreSQL.
- Unknown store implementations fail closed instead of assuming an ID namespace.
- No DDL, protocol, API routing or membership policy changes are made.

Validation: run `go test ./internal/guild` with a test `DATABASE_URL`, plus
`go test ./internal/api -run '^TestM3SocialSmokePath$' -count=1` against a fresh
isolated database. Guild tests use disposable schemas and exercise world/private/
two-guild isolation, wrapper reconstruction, shard boundaries and concurrent PG
allocation. Missing DATABASE_URL still skips the PG tests explicitly.

This prevents future misrouting; it does not infer ownership of historical
messages already written to a wrong channel. The old message rows do not preserve
the intended guild ID. Do not delete or reassign those rows automatically.
