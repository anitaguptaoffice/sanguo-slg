# INITIAL intake arbitration (SPEC-FIRST-CITY-LEDGER-INITIAL-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. Task [#2583](https://github.com/anitaguptaoffice/sanguo-slg/issues/2583). Stacks [#2582](https://github.com/anitaguptaoffice/sanguo-slg/pull/2582).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §5 + §11 **INITIAL** (PENDING+head only; no wallet/CITY/MIL/DOM; one canonical winner; retained lineage rejects EMPTY; winner keeps own name/coords; intake does not auto-execute).

Disposable PG17 harness with independent connections and readable `world_first_city_command` / slot head / harness `city_name`+`map_x`/`map_y` (fixture table only). Does not re-prove [#2568](FIRST_CITY_LEDGER_SLOT_CAS.md) / [#2572](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md) / [#2580](FIRST_CITY_LEDGER_ACK_LOSS.md) / [#2582](FIRST_CITY_LEDGER_ATOMICITY.md) frozen scenes; not absence/retention/browser/`fresh_admission.go`. `player_city_id_seq` not activated.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_initial
```

Record `SHOW server_version` and each `PASS initial:` line. Does not certify any target realm or complete §11 product acceptance.

## Follow-on

§11 **absence** (in-flight lookup): [SPEC-FIRST-CITY-LEDGER-ABSENCE-001](FIRST_CITY_LEDGER_ABSENCE.md) (`first_city_ledger_absence`).
§11 retention/cutover / native browser, realm drain/fence — separate SPEC cards.
