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
The legacy shared player_wallet.updated_at remains the restart accrual timestamp;
external writers can advance it without settling production. Exact offline accrual
across such writes needs a separately reviewed durable checkpoint design. Multiple
independent Hub writers for the same city are unsupported (city queue snapshots).
Direct CityState reads outside Hub still require caller synchronization.

Validation: real PostgreSQL domestic suite with -race covers queue restart,
external rewards, production, spend, concurrent grants/flushes and SQL failure
rollback. Unit tests cover cap preservation, arithmetic overflow and callback errors.
