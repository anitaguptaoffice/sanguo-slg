Isolated PG17 INITIAL intake arbitration (`firstcityledgerpginitial`); **not production**. Disposable `harness_initial_proposal` is test-schema fixture only. Default path is fail-closed without test `ObligationEvidence`. Does not enable `player_city_id_seq`, wallet/city effect, or API/`fresh_admission.go`.

`ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN=… go test ./internal/world/first_city_ledger_pg_initial/ -count=1 -v`

Without those variables tests **SKIP** (not FAIL). Frozen harness labels: `PASS initial:` rows in `spec/db/tests/first_city_ledger_initial`.
