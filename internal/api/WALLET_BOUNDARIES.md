# API wallet boundaries (API-REPAIR-001)

Resource-bearing quest/mail/GM rewards and shop debits commit in their owning
service before API refreshes loaded domestic cities. Refresh rereads the PG
balance through the domestic Hub; it never assigns a caller's stale snapshot to
CityState. Repeated refreshes must not become production deltas.

Post-commit refresh failure is logged, not returned as a failed debit/grant: the
operation already happened, and encouraging a retry could spend twice. Domestic
settlement/spending retries authoritative refresh before mutation. Memory-only
API wiring does not import an empty PG wallet.

GetCityState uses Hub settlement and its atomic production delta for quest
progress, excluding external grants. Wallet/cache commits and quest progress
remain separate transactions; this change does not add a distributed transaction.

Regression: TestWalletBoundaryExternalCreditSpendSettleReload uses an isolated
schema from DATABASE_URL. It covers external credit, canceled/repeated refresh,
shop debit/rejection, production, restart reload and preservation of gold.
Without DATABASE_URL the PG test is skipped, not evidence of persistence success.

Recruitment uses the military commit boundary: validate/plan under its lock,
then call domestic WithWallet to settle and debit under the authoritative PG
row lock. Only a successful wallet commit may publish/schedule the military job.
Lock order is military -> domestic -> PG; the callback must not re-enter military.
API no longer writes either live Hub's resource cache directly. StartMarch
settles via the domestic Hub before claiming a hero.

The military queue remains in-memory as before. A process crash after wallet
commit but before queue publication is not restart-atomic; durable queue/outbox
work is outside this internal-boundary repair and requires its own contract.
TestWalletBoundaryRecruitCommitFailureDoesNotQueue covers live-process commit
failure, not crash recovery.

## API-REPAIR-002: read isolation

Handlers read domestic state only through SnapshotCity (deep copy under Hub
lock), including ownership checks, reward refresh selection and build speedups.
GetCityState refreshes its snapshot after settlement. The API city registry is
locked separately and never supplies mutable state to readers.
TestGetCityStateConcurrentDomesticTick races 300 response reads against 300
scheduler ticks and verifies nested building maps do not alias Hub state.

TestContentGrantThroughAPIWalletLifecycle exercises the actual persistent content
service, duplicate reward keys, API refresh/spend/production, domestic reload,
and duplicate replay from a fresh content service; final food remains 1420.
