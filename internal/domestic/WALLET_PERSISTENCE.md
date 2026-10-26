# Wallet persistence boundary (#1718)

PG wallet rows are authoritative. SaveCity applies only a known local delta;
loaded/saved baselines advance only after the wallet/buildings/queue transaction
commits. Hub operations lock the wallet before production caps or spending and
publish a cloned city only after commit. StartBuildingUpgrade persists before
success. Background failures retain state; completed jobs retry after one second.

API callers must use RefreshWallet/SettleCityWithProduction, never assign an
externally committed balance to CityState.Wallet. WithWallet callbacks must not
re-enter Hub or the wallet transaction; cross-domain side effects need independent
staging/rollback. These internal boundaries are not a distributed transaction.

Integration hold: API and military companions are required before release.
The dedicated city_production_checkpoint is authoritative for accrual time and
fractions; player_wallet.updated_at is never used to recover production. Multiple
independent Hub writers for the same city remain unsupported (city queue snapshots).
Direct CityState reads outside Hub still require caller synchronization.

Validation: real PostgreSQL domestic suite with -race covers queue restart,
external rewards, production, spend, concurrent grants/flushes and SQL failure
rollback. Unit tests cover cap preservation, arithmetic overflow and callback errors.

## Fractional production (DOM-PRODUCTION-001 / #1782)

Per-resource integer numerators (modulo one hour in nanoseconds) retain fractions
across reads, preserving existing per-building hourly rounding. Exact arithmetic
avoids intermediate overflow and cloning preserves rollback. Settle old rates
before building changes; discard overflow/fractions at storage cap; preserve the
24-hour offline cap and same/backwards-clock no-op semantics.

DOM-PRODUCTION-002 / #1783 persists the reviewed checkpoint with the wallet,
buildings and queue in one transaction. Lock order is wallet, ownership check,
checkpoint; loads use the same consistent transaction. Existing missing checkpoints
fail closed; never lazily seed from wallet timestamps. Deployment must run the
reviewed all-city backfill under its continuous write gate before activation.

`RegisterNewCity(ctx, city) error` is for confirmed fresh world creation only. It
seeds operation `now`, rejects existing checkpoint/buildings/queue and owner/shard
mismatch, and publishes/schedules only after commit. Legacy `RegisterCity` rejects
store-backed use with an error. API bridge #1784 must propagate new registration
errors before caching/responding; this domain group alone is not deployable.

Durable matrix (#1786): `DATABASE_URL=... go test -race ./internal/domestic` covers
5-second polling with fresh pools/Hubs, submicro clocks, two cities sharing one
wallet, external credit/debit timestamps, caps/negative wallets, rate changes,
registration/owner/missing-schema guards, callback/SQL/deferred-commit rollback.
These domain tests do not replace API bridge integration or deployment backfill.
