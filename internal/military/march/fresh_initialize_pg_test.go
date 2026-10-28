package march

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func initializeFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, *FreshCityParticipant, *world.FreshCityParticipant) {
	t.Helper()
	pool, b, p := freshSourceFixture(t)
	for _, file := range []string{"001_account.sql", "002_world.sql"} {
		body, err := os.ReadFile("../../../spec/db/" + file)
		baseOK(t, err)
		baseSQL(t, pool, string(body))
	}
	baseSQL(t, pool, `CREATE SEQUENCE player_city_id_seq AS bigint START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE;
 INSERT INTO account(login_name,password_hash) VALUES('fixture','not-a-credential');
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,7,1,'fixture');
 INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,7,8000);
 INSERT INTO map_cell(server_id,x,y,terrain) VALUES(1,0,0,0)`)
	wp, _ := freshsource.Snapshot(p)
	wp.Objects = map[string]freshsource.ObjectIdentity{}
	for _, name := range []string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"} {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		wp.Objects[name] = v
	}
	o, a, ctx := baseOwner(t, b)
	m, err := NewFreshCityParticipant(ctx, b, a, p)
	baseOK(t, err)
	w, err := world.NewFreshCityParticipant(ctx, b, a, wp)
	baseOK(t, err)
	baseOK(t, o.Rollback(ctx))
	return pool, b, m, w
}

// Controlled fixture prerequisites only, not production ACCOUNT/DOM/APP wiring.
func initializeWorld(t *testing.T, b *recruittx.Binding, m *FreshCityParticipant, w *world.FreshCityParticipant) (*recruittx.Owner, *recruittx.Access, context.Context, world.FreshCity) {
	t.Helper()
	o, a, ctx := baseOwner(t, b)
	_, err := a.Exec(ctx, b, "LOCK TABLE account,player IN ROW SHARE MODE; LOCK TABLE player_wallet IN ROW EXCLUSIVE MODE")
	baseOK(t, err)
	baseOK(t, w.Pin(ctx, a))
	baseOK(t, m.Pin(ctx, a))
	var status int
	var account, food int64
	baseOK(t, a.Scan(ctx, b, "SELECT status FROM account WHERE account_id=1 FOR SHARE", nil, &status))
	baseOK(t, a.Scan(ctx, b, "SELECT account_id FROM player WHERE server_id=1 AND player_id=7 FOR SHARE", nil, &account))
	baseOK(t, a.Scan(ctx, b, "SELECT food FROM player_wallet WHERE server_id=1 AND player_id=7 FOR UPDATE", nil, &food))
	if status != 1 || account != 1 || food != 8000 {
		t.Fatal("fixture actor/wallet")
	}
	proof, err := w.Insert(ctx, a, world.City{ServerID: 1, PlayerID: 7, Name: "new", X: 0, Y: 0, WallLevel: 1, Morale: 100})
	baseOK(t, err)
	return o, a, ctx, proof
}

func TestPGFreshMilitaryInitializeAtomic(t *testing.T) {
	for _, commit := range []bool{false, true} {
		t.Run(map[bool]string{false: "rollback", true: "commit"}[commit], func(t *testing.T) {
			pool, b, m, w := initializeFixture(t)
			o, a, ctx, proof := initializeWorld(t, b, m, w)
			sample := time.Date(2026, 10, 28, 0, 0, 0, 123456789, time.UTC)
			initialized, err := m.Initialize(ctx, a, proof, sample)
			baseOK(t, err)
			if initialized.s == nil {
				t.Fatal("missing initialized proof")
			}
			var made time.Time
			var owner int64
			var cohort []byte
			baseOK(t, a.Scan(ctx, b, "SELECT created_at,owner_player_id,cohort_id FROM mil_city_origin", nil, &made, &owner, &cohort))
			if !made.Equal(sample.Truncate(time.Millisecond)) || owner != 7 || string(cohort) != string(m.state.profile.Cohort[:]) {
				t.Fatal("wrong marker")
			}
			if commit {
				baseOK(t, o.Commit(ctx))
			} else {
				baseOK(t, o.Rollback(ctx))
			}
			if id, err := initialized.Consume(ctx, a); err == nil || id != (world.CityIdentity{}) {
				t.Fatal("ended proof accepted")
			}
			var rows int
			baseOK(t, pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM player_city)+(SELECT count(*) FROM mil_city_origin)+(SELECT count(*) FROM city_troop)").Scan(&rows))
			want := 0
			if commit {
				want = 6
			}
			if rows != want {
				t.Fatalf("partial outcome %d", rows)
			}
		})
	}
}

func TestPGFreshMilitaryInitializeProofAliases(t *testing.T) {
	_, b, m, w := initializeFixture(t)
	o, a, ctx, proof := initializeWorld(t, b, m, w)
	initialized, err := m.Initialize(ctx, a, proof, time.Now())
	baseOK(t, err)
	if again, err := m.Initialize(ctx, a, proof, time.Now()); err == nil || again.s != nil {
		t.Fatal("reused world proof")
	}
	_, foreign, _ := baseOwner(t, b)
	original := *a
	*a = *foreign
	if _, err := initialized.Consume(ctx, a); err == nil {
		t.Fatal("access overwrite rebound proof")
	}
	*a = original
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := initialized.Consume(cancelled, a); err == nil {
		t.Fatal("cancelled proof")
	}
	var wins atomic.Int32
	var group sync.WaitGroup
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func(p InitializedCity) {
			defer group.Done()
			id, err := p.Consume(ctx, a)
			if err == nil {
				wins.Add(1)
				if id != (world.CityIdentity{ServerID: 1, CityID: 1, PlayerID: 7}) {
					t.Error("identity changed")
				}
			}
		}(initialized)
	}
	group.Wait()
	if wins.Load() != 1 {
		t.Fatal("proof aliases", wins.Load())
	}
	baseOK(t, o.Rollback(ctx))
}

func TestPGFreshMilitaryInitializeRejectsHistory(t *testing.T) {
	cases := map[string]string{
		"marker":            "INSERT INTO mil_city_origin VALUES(1,1,7,decode(repeat('03',16),'hex'),1,'2026-10-28T00:00:00Z')",
		"zero stock":        "INSERT INTO city_troop VALUES(1,1,1,0,0)",
		"unsupported stock": "INSERT INTO city_troop VALUES(1,1,99,0,0)",
		"completed queue":   "INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at,status) VALUES(1,100,7,1,1,now(),now(),2)",
		"receipt":           "INSERT INTO mil_recruit_origin VALUES(1,100,7,1,decode(repeat('01',16),'hex')); INSERT INTO mil_recruit_receipt VALUES(1,100,1,1,1,1,0,0,0,0,1,decode('01','hex'),decode(repeat('01',32),'hex'),'2026-10-28T00:00:00Z','2026-10-28T00:00:00Z','2026-10-28T00:00:01Z',0)",
	}
	for name, sql := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, m, w := initializeFixture(t)
			baseSQL(t, pool, sql)
			o, a, ctx, proof := initializeWorld(t, b, m, w)
			got, err := m.Initialize(ctx, a, proof, time.Now())
			if err == nil || got.s != nil {
				t.Fatal("history adopted")
			}
			baseOK(t, o.Rollback(ctx))
			var cities int
			baseOK(t, pool.QueryRow(ctx, "SELECT count(*) FROM player_city").Scan(&cities))
			if cities != 0 {
				t.Fatal("world survived rollback")
			}
		})
	}
}

func TestPGFreshMilitaryInitializeInvalidProof(t *testing.T) {
	for _, kind := range []string{"zero", "foreign transaction", "ended", "wrong shard"} {
		t.Run(kind, func(t *testing.T) {
			_, b, m, w := initializeFixture(t)
			o, a, ctx, proof := initializeWorld(t, b, m, w)
			switch kind {
			case "zero":
				proof = world.FreshCity{}
			case "foreign transaction":
				_, a, ctx = baseOwner(t, b)
				baseOK(t, m.Pin(ctx, a))
			case "ended":
				baseOK(t, o.Rollback(ctx))
				_, a, ctx = baseOwner(t, b)
				baseOK(t, m.Pin(ctx, a))
			case "wrong shard":
				p, _ := freshsource.Snapshot(m.state.profile)
				p.ServerID = 2
				var err error
				m, err = NewFreshCityParticipant(ctx, b, a, p)
				baseOK(t, err)
			}
			got, err := m.Initialize(ctx, a, proof, time.Now())
			if err == nil || got.s != nil {
				t.Fatal("invalid WORLD proof accepted")
			}
		})
	}
}
