package march

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type deploymentPG struct {
	pool    *pgxpool.Pool
	binding *recruittx.Binding
	city    *world.RecruitCityLocker
	recruit *RecruitParticipant
	store   *MarchStore
}

func newDeploymentPG(t *testing.T) deploymentPG {
	t.Helper()
	pool, b, p, store := marchStoreFixture(t)
	for _, name := range []string{"001_account.sql", "002_world.sql"} {
		ddl, err := os.ReadFile("../../../spec/db/" + name)
		baseOK(t, err)
		baseSQL(t, pool, string(ddl))
	}
	prepareBase(t, pool, p)
	baseSQL(t, pool, `CREATE SEQUENCE player_city_id_seq AS bigint START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE;
		INSERT INTO account(login_name,password_hash) VALUES('fixture','not-a-credential');
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,1,1,'fixture');
		INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,1,8000);
		INSERT INTO map_cell(server_id,x,y,terrain) VALUES(1,0,0,1);
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,100,1,'Fixture',0,0);
		SELECT setval('player_city_id_seq',100,true);
		UPDATE city_troop SET count=9,wounded=2 WHERE unit_cfg_id=2;
		UPDATE city_troop SET count=7,wounded=17 WHERE unit_cfg_id=4`)
	cat, active, waiting := preparePending(t)
	active.seed(t, pool)
	waiting.seed(t, pool)
	wp := p
	wp.Objects = make(map[string]freshsource.ObjectIdentity)
	for _, name := range []string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"} {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2",
			p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		wp.Objects[name] = v
	}
	o, a, ctx := baseOwner(t, b)
	city, err := world.NewRecruitCityLocker(ctx, b, a, wp)
	baseOK(t, err)
	recruit, err := NewRecruitParticipant(ctx, b, a, p, cat)
	baseOK(t, err)
	baseOK(t, o.Rollback(ctx))
	return deploymentPG{pool, b, city, recruit, store}
}

func (f deploymentPG) lock(ctx context.Context, a *recruittx.Access) error {
	if _, err := a.Exec(ctx, f.binding, "LOCK TABLE account,player IN ROW SHARE MODE; LOCK TABLE player_wallet IN ROW EXCLUSIVE MODE"); err != nil {
		return err
	}
	if err := f.city.Pin(ctx, a); err != nil {
		return err
	}
	if err := f.recruit.Pin(ctx, a); err != nil {
		return err
	}
	var id int64
	for _, q := range []string{
		"SELECT account_id FROM account WHERE account_id=1 AND status=1 FOR SHARE",
		"SELECT player_id FROM player WHERE server_id=1 AND player_id=1 AND account_id=1 FOR SHARE",
		"SELECT player_id FROM player_wallet WHERE server_id=1 AND player_id=1 FOR UPDATE",
	} {
		if err := a.Scan(ctx, f.binding, q, nil, &id); err != nil {
			return err
		}
	}
	return f.city.Lock(ctx, a, 1, 100)
}

func TestPGMarchDeploymentAndCreate(t *testing.T) {
	f := newDeploymentPG(t)
	in := marchStoreSample()
	in.PlayerID, in.OwnerPlayerID, in.FromX, in.FromY = 1, 1, 0, 0
	in.Troops = []TroopStack{{2, 4}, {1, 3}}
	baseSQL(t, f.pool, "ALTER TABLE army_troop ADD CONSTRAINT fixture_create_failure CHECK (unit_cfg_id <> 2)")
	before := returnAtomicState(t, f.pool, false)
	o, a, ctx := baseOwner(t, f.binding)
	baseOK(t, f.lock(ctx, a))
	ready, err := f.recruit.DebitMarchTroops(ctx, a, 1, 1, 100, in.Troops)
	baseOK(t, err)
	if ready != ([12]int32{2, 5, 0, 7}) || returnAtomicState(t, f.pool, false) != before || !prepareProbeLocked(t, f.pool, "SELECT city_id FROM player_city WHERE server_id=1 AND city_id=100") {
		t.Fatal("incorrect provisional debit, visibility or WORLD barrier", ready)
	}
	_, err = f.store.Create(ctx, a, in)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.ConstraintName != "fixture_create_failure" {
		t.Fatal("did not hit the real downstream insert failure", err)
	}
	baseOK(t, o.Rollback(ctx))
	if returnAtomicState(t, f.pool, false) != before {
		t.Fatal("failed creation leaked stock, queue or army/order writes")
	}
	baseSQL(t, f.pool, "ALTER TABLE army_troop DROP CONSTRAINT fixture_create_failure")
	o, a, ctx = baseOwner(t, f.binding)
	baseOK(t, f.lock(ctx, a))
	ready, err = f.recruit.DebitMarchTroops(ctx, a, 1, 1, 100, in.Troops)
	baseOK(t, err)
	ids, err := f.store.Create(ctx, a, in)
	baseOK(t, err)
	baseOK(t, o.Commit(ctx))
	var exact bool
	baseOK(t, f.pool.QueryRow(ctx, `SELECT
		(SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop)=ARRAY[2,5,0,7,0,0,0,0,0,0,0,0]
		AND (SELECT array_agg(wounded ORDER BY unit_cfg_id) FROM city_troop)=ARRAY[1,2,0,17,0,0,0,0,0,0,0,0]
		AND EXISTS (SELECT FROM march_order WHERE march_id=$1 AND army_id=$2 AND origin_city_id=100 AND status=1)
		AND (SELECT array_agg(count ORDER BY unit_cfg_id) FROM army_troop WHERE army_id=$2)=ARRAY[3,4]
		AND (SELECT array_agg(status ORDER BY queue_id) FROM work_queue)=ARRAY[1,0]::smallint[]
		AND (SELECT count(*) FROM mil_recruit_receipt)=2 AND (SELECT food FROM player_wallet)=8000`, ids.MarchID, ids.ArmyID).Scan(&exact))
	if ready != ([12]int32{2, 5, 0, 7}) || !exact {
		t.Fatal("confirmed debit or immutable state changed", ready, ids)
	}
}

func TestPGMarchDeploymentRejects(t *testing.T) {
	for _, tc := range []struct {
		name, corrupt string
		player        int64
		want          error
	}{
		{"insufficient despite wounded", "", 1, ErrInsufficientTroops},
		{"wrong owner", "", 2, ErrMarchDeploymentUnavailable},
		{"stock missing", "DELETE FROM city_troop WHERE unit_cfg_id=3", 1, ErrMarchDeploymentUnavailable},
		{"stock extra", "INSERT INTO city_troop VALUES(1,100,13,0,0)", 1, ErrMarchDeploymentUnavailable},
		{"wrong cohort", "UPDATE mil_city_origin SET cohort_id=decode(repeat('08',16),'hex')", 1, ErrMarchDeploymentUnavailable},
		{"bad pending receipt", "DELETE FROM mil_recruit_receipt WHERE queue_id=41", 1, ErrMarchDeploymentUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newDeploymentPG(t)
			if tc.corrupt != "" {
				baseSQL(t, f.pool, tc.corrupt)
			}
			before := returnAtomicState(t, f.pool, false)
			o, a, ctx := baseOwner(t, f.binding)
			baseOK(t, f.lock(ctx, a))
			got, err := f.recruit.DebitMarchTroops(ctx, a, 1, tc.player, 100, []TroopStack{{1, 3}, {4, 8}})
			if !errors.Is(err, tc.want) || got != ([12]int32{}) {
				t.Fatal(got, err)
			}
			baseOK(t, o.Commit(ctx)) // These definite rejections occur before any write.
			if returnAtomicState(t, f.pool, false) != before {
				t.Fatal("rejection changed source")
			}
		})
	}
}

func TestPGMarchDeploymentSerializes(t *testing.T) {
	f := newDeploymentPG(t)
	first, a, ctx := baseOwner(t, f.binding)
	second, other, run := baseOwner(t, f.binding)
	var firstPID, secondPID int32
	baseOK(t, a.Scan(ctx, f.binding, "SELECT pg_backend_pid()", nil, &firstPID))
	baseOK(t, other.Scan(run, f.binding, "SELECT pg_backend_pid()", nil, &secondPID))
	if firstPID == secondPID {
		t.Fatal("expected separate database connections")
	}
	troops := []TroopStack{{1, 4}}
	baseOK(t, f.lock(ctx, a))
	ready, err := f.recruit.DebitMarchTroops(ctx, a, 1, 1, 100, troops)
	baseOK(t, err)
	if ready[0] != 1 {
		t.Fatal(ready)
	}
	in := marchStoreSample()
	in.PlayerID, in.OwnerPlayerID, in.FromX, in.FromY, in.Troops = 1, 1, 0, 0, troops
	if _, err := f.store.Create(ctx, a, in); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	run, cancel := context.WithTimeout(run, 15*time.Second)
	defer cancel()
	go func() {
		if err := f.lock(run, other); err != nil {
			done <- err
			return
		}
		_, err := f.recruit.DebitMarchTroops(run, other, 1, 1, 100, troops)
		done <- err
	}()
	waitPrepareBlocked(t, f.pool, secondPID, firstPID)
	baseOK(t, first.Commit(ctx))
	select {
	case err := <-done:
		mustErr(t, err, ErrInsufficientTroops)
	case <-run.Done():
		t.Fatal(run.Err())
	}
	baseOK(t, second.Rollback(run))
	var remaining int32
	baseOK(t, f.pool.QueryRow(ctx, "SELECT count FROM city_troop WHERE unit_cfg_id=1").Scan(&remaining))
	if remaining != 1 || marchStoreRows(t, f.pool) != "1,1,1,0" {
		t.Fatal("concurrent deploy overspent or duplicated its march", remaining)
	}
}
