package account

import (
	"bytes"
	"context"
	"errors"
	"math"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
		"descending order":    "DROP INDEX uq_account_login_name; CREATE UNIQUE INDEX uq_account_login_name ON account(login_name DESC)",
		"nondefault opclass":  "DROP INDEX uq_account_login_name; CREATE UNIQUE INDEX uq_account_login_name ON account(login_name text_pattern_ops)",
		"extra check":         "ALTER TABLE account ADD CONSTRAINT extra CHECK(status>0)",
		"deferrable primary":  "ALTER TABLE player DROP CONSTRAINT player_pkey; ALTER TABLE player ADD PRIMARY KEY(server_id,player_id) DEFERRABLE",
		"sequence cache":      "ALTER SEQUENCE account_account_id_seq CACHE 2",
		"sequence increment":  "ALTER SEQUENCE account_account_id_seq INCREMENT 2",
		"sequence minimum":    "ALTER SEQUENCE account_account_id_seq MINVALUE 0",
		"sequence maximum":    "ALTER SEQUENCE account_account_id_seq MAXVALUE 9999",
		"sequence cycle":      "ALTER SEQUENCE account_account_id_seq CYCLE",
		"sequence start":      "ALTER SEQUENCE account_account_id_seq START WITH 2",
		// Default consumers are checked through pg_attrdef. PG17 has no safe DDL
		// for a wrong internal pg_depend link: ALTER SEQUENCE ... OWNED BY fails
		// with 0A000 for identity sequences and DROP IDENTITY removes the
		// sequence, so that specific check stays source-reviewed only.
		"sequence consumer": "CREATE TABLE extra_consumer(id bigint DEFAULT nextval('account_account_id_seq'))",
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
			replaced := map[string]string{"wrong keys": "uq_player_account_per_server", "nonunique": "uq_account_login_name", "expression": "uq_account_login_name", "include": "idx_player_account", "predicate": "idx_player_account", "collation": "uq_account_login_name", "descending order": "uq_account_login_name", "nondefault opclass": "uq_account_login_name", "deferrable primary": "player_pkey"}
			if index, ok := replaced[name]; ok {
				var id freshsource.ObjectIdentity
				actorOK(t, pool.QueryRow(context.Background(), `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, index).Scan(&id.OID, &id.OwnerOID))
				p.Objects[index] = id
			}
			// A deferrable primary key adds an internal unique_key_recheck trigger,
			// so the reused FK/RI volume check rejects it before index metadata.
			want := errFreshActorIndexes
			if name == "deferrable primary" {
				want = errFreshActorFK
			}
			_, a, ctx = actorOwner(t, b)
			if err := validateFreshActorIndexes(ctx, a, b, p); !errors.Is(err, want) {
				t.Fatalf("want %v, got %v", want, err)
			}
		})
	}
}

// A failed concurrent unique build leaves a live, invalid index. The fixture
// asserts the duplicate-key SQLSTATE and the replacement identity, then binds
// that identity so only metadata flags can reject it. On PG17 the failure also
// leaves indisready=false, so this proves the validator's conjunctive validity
// check, not indisvalid in isolation.
func TestPGFreshActorIndexesInvalid(t *testing.T) {
	pool, b, p := actorIndexFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, validateFreshActorIndexes(ctx, a, b, p))
	actorOK(t, o.Rollback(ctx))
	actorSQL(t, pool, `DROP INDEX uq_account_login_name; INSERT INTO account(login_name,password_hash) VALUES('dupe','h'),('dupe','h')`)
	_, err := pool.Exec(context.Background(), `CREATE UNIQUE INDEX CONCURRENTLY uq_account_login_name ON account(login_name)`)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		t.Fatalf("concurrent unique build: want SQLSTATE 23505, got %v", err)
	}
	var id freshsource.ObjectIdentity
	var namespace, relation uint32
	var keys string
	var unique, valid, ready, live bool
	actorOK(t, pool.QueryRow(context.Background(), `SELECT c.oid,c.relowner,c.relnamespace,i.indrelid,i.indkey::pg_catalog.text,i.indisunique,i.indisvalid,i.indisready,i.indislive
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_index i ON i.indexrelid=c.oid
 WHERE c.relnamespace=$1 AND c.relname='uq_account_login_name' AND c.relkind='i'`, p.SchemaOID).
		Scan(&id.OID, &id.OwnerOID, &namespace, &relation, &keys, &unique, &valid, &ready, &live))
	if namespace != p.SchemaOID || relation != p.Objects["account"].OID || keys != "2" || !unique || valid || !live {
		t.Fatalf("invalid fixture identity/shape: ns=%d rel=%d keys=%q unique=%t valid=%t ready=%t live=%t", namespace, relation, keys, unique, valid, ready, live)
	}
	t.Logf("failed concurrent index flags: indisvalid=%t indisready=%t indislive=%t", valid, ready, live)
	p.Objects["uq_account_login_name"] = id
	_, a, ctx = actorOwner(t, b)
	if err := validateFreshActorIndexes(ctx, a, b, p); !errors.Is(err, errFreshActorIndexes) {
		t.Fatalf("invalid index: want %v, got %v", errFreshActorIndexes, err)
	}
}
