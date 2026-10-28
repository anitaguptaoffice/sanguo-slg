package account

import (
	"bytes"
	"context"
	"math"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func actorIndexFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := actorFKFixture(t)
	for _, name := range append(freshActorIndexNames[:], "account_account_id_seq") {
		var id freshsource.ObjectIdentity
		actorOK(t, pool.QueryRow(context.Background(), `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, name).Scan(&id.OID, &id.OwnerOID))
		p.Objects[name] = id
	}
	return pool, b, p
}

func TestPGFreshActorIndexesIdentityAndReadOnly(t *testing.T) {
	pool, b, p := actorIndexFixture(t)
	actorSQL(t, pool, `INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(7,'fixture','fixture-only-hash');
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,8,7,'fixture');
 INSERT INTO account_session(session_id,account_id,expires_at) VALUES('00000000-0000-0000-0000-000000000007',7,'2030-01-01T00:00:00Z')`)
	o, a, ctx := actorOwner(t, b)
	const snapshot = `SELECT pg_catalog.jsonb_build_array(
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY account_id) FROM account x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY server_id,player_id) FROM player x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY session_id) FROM account_session x),
 pg_catalog.current_setting('search_path'),pg_catalog.current_setting('TimeZone'),pg_catalog.current_setting('DateStyle'),current_user,session_user)`
	var dataBefore, dataAfter []byte
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &dataBefore))
	seq := pgx.Identifier{p.SchemaName, "account_account_id_seq"}.Sanitize()
	var before, after int64
	var calledBefore, calledAfter bool
	actorOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM "+seq, nil, &before, &calledBefore))
	actorOK(t, validateFreshActorIndexes(ctx, a, b, p))
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &dataAfter))
	if !bytes.Equal(dataBefore, dataAfter) {
		t.Fatal("validator changed actor data or caller settings")
	}
	actorOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM "+seq, nil, &after, &calledAfter))
	if before != after || calledBefore != calledAfter {
		t.Fatal("validator allocated or reset identity")
	}
	for _, name := range append(freshActorIndexNames[:], "account_account_id_seq") {
		for _, mode := range []int{0, 1, 2} {
			bad, _ := freshsource.Snapshot(p)
			id := bad.Objects[name]
			switch mode {
			case 0:
				delete(bad.Objects, name)
			case 1:
				id.OID++
				bad.Objects[name] = id
			case 2:
				id.OwnerOID++
				bad.Objects[name] = id
			}
			if validateFreshActorIndexes(ctx, a, b, bad) == nil {
				t.Fatal("wrong expectation", name, mode)
			}
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshActorIndexes(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	actorOK(t, o.Rollback(ctx))
	if validateFreshActorIndexes(ctx, a, b, p) == nil {
		t.Fatal("ended access")
	}
	// Valid exhaustion is irrelevant to inspecting existing actors; no allocation.
	_, err := pool.Exec(ctx, "SELECT pg_catalog.setval($1::pg_catalog.regclass,$2,true)", seq, int64(math.MaxInt64))
	actorOK(t, err)
	_, a, ctx = actorOwner(t, b)
	actorOK(t, validateFreshActorIndexes(ctx, a, b, p))
}

func TestPGFreshActorIndexesDrift(t *testing.T) {
	cases := map[string]string{
		"missing index":       "DROP INDEX idx_player_account",
		"extra index":         "CREATE INDEX extra ON player(power)",
		"replaced same index": "DROP INDEX idx_player_account; CREATE INDEX idx_player_account ON player(account_id)",
		"options":             "ALTER INDEX player_pkey SET(fillfactor=70)",
		"wrong keys":          "DROP INDEX uq_player_account_per_server; CREATE UNIQUE INDEX uq_player_account_per_server ON player(account_id,server_id)",
		"nonunique":           "DROP INDEX uq_account_login_name; CREATE INDEX uq_account_login_name ON account(login_name)",
		"expression":          "DROP INDEX uq_account_login_name; CREATE UNIQUE INDEX uq_account_login_name ON account(lower(login_name))",
		"include":             "DROP INDEX idx_player_account; CREATE INDEX idx_player_account ON player(account_id) INCLUDE(power)",
		"predicate":           "DROP INDEX idx_player_account; CREATE INDEX idx_player_account ON player(account_id) WHERE power>0",
		"collation":           "DROP INDEX uq_account_login_name; CREATE UNIQUE INDEX uq_account_login_name ON account(login_name COLLATE pg_catalog.\"C\")",
		"extra check":         "ALTER TABLE account ADD CONSTRAINT extra CHECK(status>0)",
		"deferrable primary":  "ALTER TABLE player DROP CONSTRAINT player_pkey; ALTER TABLE player ADD PRIMARY KEY(server_id,player_id) DEFERRABLE",
		"sequence cache":      "ALTER SEQUENCE account_account_id_seq CACHE 2",
		"sequence increment":  "ALTER SEQUENCE account_account_id_seq INCREMENT 2",
		"sequence minimum":    "ALTER SEQUENCE account_account_id_seq MINVALUE 0",
		"sequence maximum":    "ALTER SEQUENCE account_account_id_seq MAXVALUE 9999",
		"sequence cycle":      "ALTER SEQUENCE account_account_id_seq CYCLE",
		"sequence start":      "ALTER SEQUENCE account_account_id_seq START WITH 2",
		"sequence consumer":   "CREATE TABLE extra_consumer(id bigint DEFAULT nextval('account_account_id_seq'))",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := actorIndexFixture(t)
			o, a, ctx := actorOwner(t, b)
			actorOK(t, validateFreshActorIndexes(ctx, a, b, p))
			actorOK(t, o.Rollback(ctx))
			actorSQL(t, pool, ddl)
			// This owned negative fixture deliberately expects the replacement identity
			// to isolate structural rejection. Production must never recapture a source.
			replaced := map[string]string{"wrong keys": "uq_player_account_per_server", "nonunique": "uq_account_login_name", "expression": "uq_account_login_name", "include": "idx_player_account", "predicate": "idx_player_account", "collation": "uq_account_login_name", "deferrable primary": "player_pkey"}
			if index, ok := replaced[name]; ok {
				var id freshsource.ObjectIdentity
				actorOK(t, pool.QueryRow(context.Background(), `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, index).Scan(&id.OID, &id.OwnerOID))
				p.Objects[index] = id
			}
			_, a, ctx = actorOwner(t, b)
			if validateFreshActorIndexes(ctx, a, b, p) == nil {
				t.Fatal("index/sequence drift accepted")
			}
		})
	}
}
