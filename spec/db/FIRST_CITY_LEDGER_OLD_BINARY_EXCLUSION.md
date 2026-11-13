# Old writer / rollback binary exclusion (SPEC-FIRST-CITY-LEDGER-OLD-BINARY-EXCLUSION-001)

Not deployed / realm / cutover / production rollback artifact. [#2593](https://github.com/anitaguptaoffice/sanguo-slg/issues/2593); [#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) five scenes not re-run. CITY_CREATION_RECOVERY §9/§11; OID §5.6 / §6.1+11.

Disposable PG17; child calls `internal/world/city_creation.go` `CreateCityInTx`; second child = prior-release rep (signed rollback field exclusion follow-on).

Five `PASS old_binary_exclusion:` scenes in harness; observer rows only. Out of scope: #2592–#2584 frozen paths, `cmd/server`, WS/browser, §10.5–7, realm, production drain/fence controller.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_old_binary_exclusion
```
