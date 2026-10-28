package domestic

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// This owned fixture executes the actual reviewed 003 DDL, not a reconstructed
// wallet approximation. Profile discovery here supplies test data, not approval.
func recruitWalletFixture(t *testing.T, quoted bool) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	admin := openDomesticTestDB(t)
	name := fmt.Sprintf("recruit_wallet_%d", time.Now().UnixNano())
	if quoted {
		name += `_Q"x`
	}
	if _, err := admin.Exec(context.Background(), "CREATE SCHEMA "+pgx.Identifier{name}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	cfg := admin.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{name}.Sanitize()
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+pgx.Identifier{name}.Sanitize()+" CASCADE"); err != nil {
			t.Error(err)
		}
		admin.Close()
	})
	ddl, err := os.ReadFile("../../spec/db/003_domestic.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(context.Background(), string(ddl)); err != nil {
		t.Fatal(err)
	}
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "fixture", EvidenceRef: "fixture-not-enrollment", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	err = pool.QueryRow(context.Background(), `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID)
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range []string{"player_wallet", "player_wallet_pkey"} {
		var o freshsource.ObjectIdentity
		if err = pool.QueryRow(context.Background(), `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, n).Scan(&o.OID, &o.OwnerOID); err != nil {
			t.Fatal(err)
		}
		p.Objects[n] = o
	}
	b, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	return pool, b, p
}
func recruitWalletBegin(t *testing.T, ctx context.Context, b *recruittx.Binding) (*recruittx.Owner, *recruittx.Access) {
	t.Helper()
	o, err := b.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		clean, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = o.Rollback(clean)
	})
	return o, o.Access()
}

func TestPGRecruitWalletIdentityAndPin(t *testing.T) {
	for _, quoted := range []bool{false, true} {
		t.Run(fmt.Sprint(quoted), func(t *testing.T) {
			pool, b, p := recruitWalletFixture(t, quoted)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,9,123)`); err != nil {
				t.Fatal(err)
			}
			o, a := recruitWalletBegin(t, ctx, b)
			changes := []func(*freshsource.Profile){func(p *freshsource.Profile) { p.DatabaseName += "x" }, func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.SchemaName += "x" }, func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleName += "x" }, func(p *freshsource.Profile) { p.CurrentRoleOID++ }, func(p *freshsource.Profile) { p.SessionRoleName += "x" }, func(p *freshsource.Profile) { p.SessionRoleOID++ }, func(p *freshsource.Profile) { delete(p.Objects, "player_wallet") }, func(p *freshsource.Profile) { p.Objects["other"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1} }}
			for _, n := range []string{"player_wallet", "player_wallet_pkey"} {
				for _, owner := range []bool{false, true} {
					n, owner := n, owner
					changes = append(changes, func(p *freshsource.Profile) {
						v := p.Objects[n]
						if owner {
							v.OwnerOID++
						} else {
							v.OID++
						}
						p.Objects[n] = v
					})
				}
			}
			for i, change := range changes {
				bad, _ := freshsource.Snapshot(p)
				change(&bad)
				if got, err := NewRecruitWallet(ctx, b, a, bad); err == nil || got != nil {
					t.Fatalf("mismatch %d", i)
				}
			}
			w, err := NewRecruitWallet(ctx, b, a, p)
			if err != nil {
				t.Fatal(err)
			}
			p.Objects["player_wallet"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
			p.SchemaName = "changed"
			var before, after string
			if err = a.Scan(ctx, b, `SELECT current_setting('search_path')`, nil, &before); err != nil {
				t.Fatal(err)
			}
			if err = w.Pin(ctx, a); err != nil {
				t.Fatal(err)
			}
			var food int64
			if err = a.Scan(ctx, b, "SELECT food FROM "+pgx.Identifier{w.profile.SchemaName, "player_wallet"}.Sanitize()+" WHERE server_id=1 AND player_id=9", nil, &food); err != nil || food != 123 {
				t.Fatal(food, err)
			}
			var count int
			if err = a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_locks WHERE pid=pg_backend_pid() AND granted AND relation=$1 AND mode='RowExclusiveLock'`, []any{w.profile.Objects["player_wallet"].OID}, &count); err != nil || count != 1 {
				t.Fatal(count, err)
			}
			if err = a.Scan(ctx, b, `SELECT current_setting('search_path')`, nil, &after); err != nil || before != after {
				t.Fatal(after, err)
			}
			wrong, _ := recruittx.NewBinding(pool)
			_, foreign := recruitWalletBegin(t, ctx, wrong)
			if w.Pin(ctx, foreign) == nil {
				t.Fatal("wrong binding")
			}
			canceled, cancelNow := context.WithCancel(ctx)
			cancelNow()
			if w.Pin(canceled, a) == nil {
				t.Fatal("canceled")
			}
			if w.retired.Load() {
				t.Fatal("wrong access retired source")
			}
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			if w.Pin(ctx, a) == nil {
				t.Fatal("ended access")
			}
			_, next := recruitWalletBegin(t, ctx, b)
			if err = w.Pin(ctx, next); err != nil {
				t.Fatal("healthy after wrong access", err)
			}
		})
	}
}

func TestPGRecruitWalletDriftRetiresCopies(t *testing.T) {
	cases := map[string]string{"column": "ALTER TABLE player_wallet ADD surprise integer", "default": "ALTER TABLE player_wallet ALTER food SET DEFAULT 1", "constraint": "ALTER TABLE player_wallet ADD CHECK(food>=0)", "index": "CREATE INDEX surprise ON player_wallet(food)", "rename": "ALTER TABLE player_wallet RENAME TO parked", "view dependency": "CREATE VIEW surprise AS SELECT food FROM player_wallet"}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := recruitWalletFixture(t, false)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := recruitWalletBegin(t, ctx, b)
			w, err := NewRecruitWallet(ctx, b, a, p)
			if err != nil {
				t.Fatal(err)
			}
			copied := *w
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			if _, err = pool.Exec(ctx, ddl); err != nil {
				t.Fatal(err)
			}
			_, a = recruitWalletBegin(t, ctx, b)
			if err = w.Pin(ctx, a); err == nil || !w.retired.Load() {
				t.Fatal("drift admitted", err)
			}
			if copied.Pin(ctx, a) == nil || !copied.retired.Load() {
				t.Fatal("copy not retired")
			}
		})
	}
}
