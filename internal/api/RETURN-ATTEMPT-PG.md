# API-RETURN-ATTEMPT-PG-001

Task [#2146](https://github.com/anitaguptaoffice/sanguo-slg/issues/2146).
Depends on dormant source [#2145](https://github.com/anitaguptaoffice/sanguo-slg/issues/2145).
These tests call the real private APP `complete`, not a simulated participant chain.
The existing 43-object API source fixture supplies original migrations and distinct
pool/observer connections. Original HERO DDL adds unchanged-state sentinels only.
Synthetic graph setup is not enrollment or proof of creation/debit/arrival writers.

Coverage: due credit, exact int32 reserved-capacity boundary and overflow where R+S
fits but R+P+S does not; confirmed early, credited duplicate and annihilation; retained
UTC microseconds; single outer transaction; no sequence allocation; no resolved lease
or record leak. Full snapshots preserve tuples for every untouched table, including
wallet, queued work, receipts, HERO rows, retained survivors and explicit sequence
last_value/log_cnt/is_called. Applied snapshots mask only count/status/position writes.
Pending rows are synthetic valid catalog/receipt evidence, not actual Recruit admission
or concurrent completion compatibility. The second actor seed exists for later tests.

Prepared tests-first against the registered method. Local `go` is not Go; no compile,
runtime pass or behavioral red is claimed. Official Go1.23.12/PG17.11 ordinary/race
with zero unexpected skips and exact independent review remain required. Other cards
must cover observed pin/row order, duplicate/Recruit races, SQL/deferred commit faults,
lost acknowledgements, process death and unresolved drain. No production wiring,
recovery, publication, deployment or historical hold release is included.
