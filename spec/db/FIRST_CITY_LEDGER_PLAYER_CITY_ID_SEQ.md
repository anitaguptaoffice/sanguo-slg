# WORLD `player_city_id_seq` contract (SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001)

Registered draft; **not** production activation, realm enrollment, drain/fence execution, retained highwater inventory,
runtime Go allocator, or `002_world.sql` adoption. Task: [#2685](https://github.com/anitaguptaoffice/sanguo-slg/issues/2685).
Aligns with frozen [WORLD_CITY_IDENTITY.md](../rules/WORLD_CITY_IDENTITY.md) (SPEC-WORLD-CITY-ID-001 / #1862); does not rewrite that rule text.

## 1. Object (schema-qualified)

| Property | Value |
|----------|--------|
| Name | `<application_schema>.player_city_id_seq` (disposable harness uses same unqualified name in an isolated schema) |
| Kind | permanent ordinary sequence (`relkind = S`, `relpersistence = p`) |
| Type | `AS bigint` |
| START | 1 |
| MINVALUE | 1 |
| MAXVALUE | 9223372036854775807 |
| INCREMENT | 1 |
| CACHE | 1 |
| CYCLE | NO |
| OWNED BY | NONE (no table default / identity column) |

No automatic unrelated schema creation, no helper `GRANT`, no table-attached identity. Wrong kind, wrong owner, wrong property,
or partial object → **unavailable** (fail-closed); no `DROP`/recreate/adoption, no MAX(current)+1 fallback.

SQL body (harness-gated no-op on ApplySpecs default path): `m4_014_first_city_ledger_player_city_id_seq.sql`.

## 2. Next-value semantics (WORLD_CITY_IDENTITY §3)

For validated state `(last_value=L, is_called=C)`:

- Next candidate = **L** when `C=false`, else **L+1** (only when not exhausted).
- `C=true` and `L=MaxInt64` → exhausted; **no** overflowing addition.
- Never `setval(0, ...)`.
- Genuinely empty independent history: new sequence starts `L=1, C=false`; first allocation **1**.
- Fixture highwater **H** (disposable tests only): if existing next **> H**, preserve greater state and `is_called`; if next ≤ H and H < MaxInt64, permitted forward is `setval(H, true)` so next is **H+1**. Empty tables do **not** reset an existing sequence to the empty-history start.

`setval` / `nextval` effects may survive transaction `ROLLBACK`. Failed maintenance must not lower or recreate the sequence as compensation.

## 3. Boundaries (this card does not claim)

- Target database approval, complete owner-reviewed cross-shard highwater inventory, production drain/fence, cutover, deployment, live route, or reviewed runtime allocation in `internal/world`.
- Playable-first-city product acceptance or realm authentication.
- Changes to `m4_010`–`m4_013`, `002_world.sql`, wire / `durable_state`, or [SEQUENCE-REPAIR-EXCLUSION](FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md) (not `player_city_id_seq`).

## 4. Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_player_city_id_seq
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0.

## 5. Follow-on (separate SPEC cards)

Crash barriers, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence (remainder of [FIRST_CITY_LEDGER_VALIDATE_ONLY.md](FIRST_CITY_LEDGER_VALIDATE_ONLY.md) §5 after this card).
