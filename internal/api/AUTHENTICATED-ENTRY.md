# Authenticated entry wire preservation

[API-AUTH-IDENTITY-ENTRY-001 / #2372](https://github.com/anitaguptaoffice/sanguo-slg/issues/2372)
adds compatibility evidence, not a production fix. The existing wrapper decodes
and remarshals the adopted ACCOUNT message without reconstructing its fields.
The earlier starter test checked only response status/notice; the earlier
WebSocket shard test checked only server/player.

`TestAuthenticatedEntryWirePG` traverses real binary WebSocket frames,
`gateway.Server`, `account.SessionValidator`, `Server.GatewayRouter`, the concrete
ACCOUNT service and PLATFORM producer, then API tutorial/starter processing.
The isolated existing PG fixture applies canonical schemas and quest seed data.
Real registration hashes test credentials; sequence positions give exact account
IDs 9007199254740993 and 9223372036854775807. No fabricated authentication session,
mock validator, fake producer or token-derived identity is used.

The actual registered Login first encounters a deferred grant-commit failure.
Entry retains account identity while refreshing an explicit historical completed
quest fixture to level 5 and returning the pending notice. Removing the trigger
allows one genuine entry grant; a repeated entry cannot duplicate it. Response
session, expiry, server, complete player and wallet are compared with SQL truth;
all wallet columns, including timestamps, remain unchanged. Re-login, renewal,
shard/account switches, zero/missing wallets and error responses are covered.
Unknown-route controls distinguish real gateway rejection from shard validation.
Profile refresh fails after the producer has already bound the actor; no binding
rollback is claimed, and no response Data/private diagnostic may escape.

Run against an owned disposable PostgreSQL 17 database with official Go 1.23.12:

    DATABASE_URL=... go test ./internal/api -run '^TestAuthenticatedEntryWirePG$' -count=1 -json
    DATABASE_URL=... go test ./internal/api -run '^TestAuthenticatedEntryWirePG$' -count=1 -race -json

A separately owned CI change must persist all named cases in the full API gate.
Full ordinary/race API execution within the unchanged 120-minute budget, zero
skips, official formatting, independent review and all required checks remain
mandatory. Local static inspection is not compilation/runtime acceptance.
These explicit SQL/failure fixtures do not prove natural onboarding, native
client/browser behavior, concurrent revocation linearizability, V2 activation,
durable journal restart, production rollout or release of historical holds.
