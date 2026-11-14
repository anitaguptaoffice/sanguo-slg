Isolated PG17 first-city **PENDING intake + slot CAS** only (`firstcityledgerpgintake`). Not production: no realm/cutover/`player_city_id_seq`/API/cmd.

```bash
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
go test ./internal/world/first_city_ledger_pg_intake/ -count=1 -v
```
