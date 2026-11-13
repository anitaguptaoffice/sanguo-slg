# WORLD first-city ledger restricted-role ACL / privilege separation (SPEC-FIRST-CITY-LEDGER-ACL-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2676](https://github.com/anitaguptaoffice/sanguo-slg/issues/2676). Stacks on draft PR [#2675](https://github.com/anitaguptaoffice/sanguo-slg/pull/2675).

Depends on [FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §2 `writer_roles` and §5 item 5,
frozen `m4_010_first_city_ledger.sql`, `m4_011_first_city_ledger_companion.sql`, `m4_012_first_city_ledger_pending_unique_index.sql`
(bodies unchanged by this card).

## 1. Role categories (harness names only; not production enrollment)

Aligned with OID §2 `writer_roles` — **observed grants in disposable PG17 only**; this card does **not** publish or widen production GRANT/REVOKE catalogs.

| Category | Harness obligation |
|----------|-------------------|
| Provisioning | May apply `m4_*` via disposable admin path; credentials are **not** runtime pool roles. |
| Migration owner | Single-schema DDL / ownership surface for ledger relations; **not** identical to any runtime writer. |
| Runtime APP / WORLD / ACCOUNT | Non-superuser writers with **only** the grants under test (WORLD harness holds narrow DML on `world_first_city_*`). |
| Maintenance | Co-located batch/maintenance; **no** ledger DML unless explicitly granted in a reviewed enrollment (harness: no write). |
| Read-only discovery | `SELECT` on ledger directory allowed; **no** `INSERT`/`UPDATE`/`DELETE` on `world_first_city_*`. |

## 2. Mandatory obligations (fail-closed)

1. **Separation:** All categories above are distinguishable roles in a one-shot cluster session.
2. **Runtime ≠ provisioning / migration owner:** Runtime roles are not `SUPERUSER`, not the migration-owner role, and do not hold migration-owner DDL / ownership (no `CREATE`/`DROP` on `world_first_city_*` relations).
3. **No write without grant:** Roles lacking ledger DML fail `INSERT`/`UPDATE`/`DELETE` with **42501**; an independent observer sees **no** new rows and **no** row mutation.
4. **Discovery read-only:** Discovery with `SELECT` still cannot write ledger tables; failures leave row-level state unchanged.
5. **No partial enablement:** Any failed obligation keeps the path **closed**; partial grants are not partial production enablement.

OID §5 items 1–4, 6 (through-commit drain, substitute fences, whole-boundary fence, DDL serialization, rollback binary) remain frozen in their own SPEC cards — **not** re-proven here.

## 3. Boundaries

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- invent wire fields, `durable_state` values, or production role names;
- change `m4_010` / `m4_011` / `m4_012` SQL bodies or embed production ACL DDL in those files;
- activate `validate_only` GUC, `player_city_id_seq`, CITY_CREATION_RECOVERY §10 items 3/5–7, or realm drain/fence execution;
- claim playable first-city or real-backend product acceptance is complete.

Role creation and grants exist **only** inside the disposable harness (`spec/db/tests/first_city_ledger_acl`); no reusable production roles.

## 4. Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_acl
```

Without `ALLOW_OWNED_PG17_TEST=1` or `FIRST_CITY_LEDGER_TEST_DSN`, the harness prints `SKIP` and exits 0.

Harness records PostgreSQL `server_version`, role attributes (`rolsuper`, `pg_auth_members`), **42501** on denied DML, and observer row counts before/after each denied attempt.

## 5. Follow-on (separate SPEC cards)

Crash barriers, `validate_only` GUC, `player_city_id_seq`, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence (remainder of [FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md) Follow-on after ACL).
