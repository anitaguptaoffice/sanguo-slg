# API-PLAYER-BOOTSTRAP-TX

`PlayerStore.EnsurePlayer` creates a shard character and its initial wallet in
one PostgreSQL transaction. Existing characters retain the read-only fast path;
new creation takes the transaction advisory lock `(0x504c4159, server_id)` and
rechecks the account before allocating the existing shard-local `MAX+1` ID.
The transaction uses READ COMMITTED so the locked recheck sees a preceding
creator's commit. Exhausted bigint IDs fail with the database overflow error;
there is no reset, wraparound, or fallback allocator.

Player fields/defaults and wallet amounts remain unchanged: food/wood 8000,
iron/stone 5000, gold 0. Wallet conflicts still do nothing, preserving an existing
orphan wallet without topping it up. No new schema, reward grant, or starter
policy is introduced. A database error, cancellation, or lost connection before
commit rolls back both writes. If commit succeeds but its response is lost, a
retry observes the committed character without minting another wallet.

Historical characters with no wallet remain unchanged. Diagnose those records
separately; login is not a migration or an authorization to grant funds. The
existing starter guard continues waiting for the actual player/wallet join.

## Deployment boundary

All player creators must use this lock protocol. Drain old-version creators
before relying on concurrent MAX+1 allocation during an upgrade; an old writer
or direct SQL does not honor advisory locks. Database uniqueness constraints
remain the final guard and an unrelated writer can still make creation fail.

## Verification

With `DATABASE_URL` pointing to a disposable PostgreSQL database, run:

    go test -race ./internal/api -run '^TestPlayerBootstrap' -count=1

Tests isolate schemas and exercise concurrent duplicate/different accounts on
two shards, shard-lock isolation and cancellation, SQL/commit failures,
connection termination, invisible staged writes, retry/dedupe, exact initial
values, existing/orphan-wallet preservation, legacy missing-wallet non-repair,
and ID exhaustion. These tests do not authorize historical repair or deployment.
