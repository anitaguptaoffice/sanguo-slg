// DOM-FRESH-PREPARED-CITY-STAGE-PG-001: PG QA for PreparedCity Stage/Publish only.
// Product base: 15222d663edc3bd9b84e5e884dc77e4bb7e538c6 on branch cursor/dom-fresh-prepared-city-001-384a.
// Actor locks and WORLD/MIL prerequisites here are a controlled fixture subset, not ACCOUNT/APP enrollment.
package domestic

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var worldStageObjects = [...]string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"}
var milStageObjects = [...]string{
	"mil_city_origin", "mil_city_origin_pkey", "city_troop", "city_troop_pkey",
	"work_queue", "work_queue_pkey", "idx_work_queue_due", "idx_work_queue_player",
	"mil_recruit_origin", "mil_recruit_receipt", "mil_recruit_origin_pkey",
	"mil_recruit_origin_server_id_player_id_operation_command_id_key", "mil_recruit_receipt_pkey",
	"work_queue_id_seq",
}

type preparedCityStageEnv struct {
	*freshSourcePG
	world *world.FreshCityParticipant
	mil   *march.FreshCityParticipant
}

func preparedCityStageExtendSchema(t *testing.T, ctx context.Context, f *freshSourcePG) {
	t.Helper()
	for _, file := range []string{"001_account.sql", "002_world.sql", "004_military.sql"} {
		body, err := os.ReadFile(filepath.Join("..", "..", "spec", "db", file))
		if err != nil {
			t.Fatal(err)
		}
		freshCatalogPGExec(t, ctx, f.pool, string(body))
	}
	dsn := os.Getenv("DATABASE_URL")
	schema := f.profile.SchemaName
	cmd := exec.CommandContext(ctx, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "target="+schema, "-v", "city_origin_schema="+schema, "-d", dsn)
	cmd.Stdin = strings.NewReader("SELECT pg_catalog.set_config('search_path',pg_catalog.format('%I,pg_catalog', :'target'),false);\n\\ir ../../spec/db/m4_008_work_queue_id_sequence.sql\n\\ir ../../spec/db/migrations/008_create_recruit_storage.psql\n\\ir ../../spec/db/migrations/010_create_mil_city_origin.psql\n")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("mil entry ddl: %v\n%s", err, out)
	}
	freshCatalogPGExec(t, ctx, f.pool, `CREATE SEQUENCE IF NOT EXISTS player_city_id_seq AS bigint START 1 INCREMENT 1 NO CYCLE;
INSERT INTO account(login_name,password_hash) VALUES ('stage_qa','x') ON CONFLICT DO NOTHING;
INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,7,1,'stage_qa') ON CONFLICT DO NOTHING;
INSERT INTO map_cell(server_id,x,y,terrain) VALUES (1,0,0,0) ON CONFLICT DO NOTHING;`)
}

func preparedCityStageProfile(t *testing.T, ctx context.Context, pool *pgxpool.Pool, base freshsource.Profile, names []string) freshsource.Profile {
	t.Helper()
	p, err := freshsource.Snapshot(base)
	if err != nil {
		t.Fatal(err)
	}
	p.Objects = make(map[string]freshsource.ObjectIdentity, len(names))
	for _, name := range names {
		var o freshsource.ObjectIdentity
		if err := pool.QueryRow(ctx, `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, name).Scan(&o.OID, &o.OwnerOID); err != nil {
			t.Fatal(name, err)
		}
		p.Objects[name] = o
	}
	return p
}

func preparedCityStageStack(t *testing.T, ctx context.Context) *preparedCityStageEnv {
	t.Helper()
	f := freshSourcePGFixture(t, ctx, false)
	preparedCityStageExtendSchema(t, ctx, f)
	wp := preparedCityStageProfile(t, ctx, f.pool, f.profile, worldStageObjects[:])
	mp := preparedCityStageProfile(t, ctx, f.pool, f.profile, milStageObjects[:])
	o, a := recruitWalletBegin(t, ctx, f.binding)
	w, err := world.NewFreshCityParticipant(ctx, f.binding, a, wp)
	if err != nil {
		t.Fatal("world", err)
	}
	m, err := march.NewFreshCityParticipant(ctx, f.binding, a, mp)
	if err != nil {
		t.Fatal("march", err)
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	return &preparedCityStageEnv{f, w, m}
}

// preparedCityStageActorLocks mirrors march/world PG tests only; not production ACCOUNT participant wiring.
func preparedCityStageActorLocks(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, schema string) error {
	q := func(name string) string { return pgx.Identifier{schema, name}.Sanitize() }
	if _, err := a.Exec(ctx, b, "LOCK TABLE "+q("account")+","+q("player")+" IN ROW SHARE MODE"); err != nil {
		return err
	}
	_, err := a.Exec(ctx, b, "LOCK TABLE "+q("player_wallet")+" IN ROW EXCLUSIVE MODE")
	return err
}

func preparedCityStageWorldMil(ctx context.Context, t *testing.T, s *preparedCityStageEnv, a *recruittx.Access) (world.FreshCity, march.InitializedCity, time.Time) {
	t.Helper()
	if err := preparedCityStageActorLocks(ctx, a, s.binding, s.profile.SchemaName); err != nil {
		t.Fatal(err)
	}
	if err := s.world.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	if err := s.mil.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	var status int
	var account int64
	if err := a.Scan(ctx, s.binding, "SELECT status FROM "+pgx.Identifier{s.profile.SchemaName, "account"}.Sanitize()+" WHERE account_id=1 FOR SHARE", nil, &status); err != nil || status != 1 {
		t.Fatal("account", err, status)
	}
	if err := a.Scan(ctx, s.binding, "SELECT account_id FROM "+pgx.Identifier{s.profile.SchemaName, "player"}.Sanitize()+" WHERE server_id=1 AND player_id=7 FOR SHARE", nil, &account); err != nil || account != 1 {
		t.Fatal("player", err, account)
	}
	proof, err := s.world.Insert(ctx, a, world.City{ServerID: 1, PlayerID: 7, Name: "qa", X: 0, Y: 0, WallLevel: 1, Morale: 100})
	if err != nil {
		t.Fatal("world insert", err)
	}
	at := time.Date(2026, 11, 12, 8, 0, 0, 456789000, time.UTC)
	init, err := s.mil.Initialize(ctx, a, proof, at)
	if err != nil {
		t.Fatal("mil initialize", err)
	}
	return proof, init, at
}

func preparedCityStageDOM(ctx context.Context, t *testing.T, s *preparedCityStageEnv, a *recruittx.Access, pc *PreparedCity) {
	t.Helper()
	freshSourcePGPin(t, ctx, s.source, a)
	if err := pc.LockWallet(ctx, a); err != nil {
		t.Fatal("lock wallet", err)
	}
}

func preparedCityStageDOMRows(ctx context.Context, t *testing.T, s *preparedCityStageEnv, cityID int64) int {
	t.Helper()
	cpTab := pgx.Identifier{s.profile.SchemaName, "city_production_checkpoint"}.Sanitize()
	bTab := pgx.Identifier{s.profile.SchemaName, "city_building"}.Sanitize()
	var rows int
	err := s.pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM "+cpTab+" WHERE server_id=1 AND city_id=$1)+(SELECT count(*) FROM "+bTab+" WHERE server_id=1 AND city_id=$1)", cityID).Scan(&rows)
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestPGPreparedCityStageQAFlow(t *testing.T) {
	initial, _ := freshTemplateSourceInput()

	t.Run("commit_publish_and_close", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		stack := preparedCityStageStack(t, ctx)
		pc, err := stack.source.Prepare(ctx, initial)
		if err != nil {
			t.Fatal(err)
		}
		o, a := recruitWalletBegin(t, ctx, stack.binding)
		_, init, at := preparedCityStageWorldMil(ctx, t, stack, a)
		preparedCityStageDOM(ctx, t, stack, a, pc)
		identity, err := pc.Stage(ctx, a, init, at)
		if err != nil {
			t.Fatal("stage", err)
		}
		if identity.CityID <= 0 || identity.PlayerID != 7 {
			t.Fatal("identity", identity)
		}
		if _, err := pc.Stage(ctx, a, init, at); err == nil {
			t.Fatal("second stage admitted")
		}
		if err := o.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		wantAt := at.UTC().Truncate(time.Microsecond)
		wantSub := int16(at.Nanosecond() % 1000)
		cpTab := pgx.Identifier{stack.profile.SchemaName, "city_production_checkpoint"}.Sanitize()
		var cpPlayer int64
		var settled time.Time
		var sub int16
		if err := stack.pool.QueryRow(ctx, "SELECT player_id,settled_at,settled_submicro_ns FROM "+cpTab+" WHERE server_id=1 AND city_id=$1", identity.CityID).Scan(&cpPlayer, &settled, &sub); err != nil || cpPlayer != 7 || !settled.Equal(wantAt) || sub != wantSub {
			t.Fatal("checkpoint row", cpPlayer, settled, sub, wantAt, wantSub, err)
		}
		if err := pc.Publish(); err != nil {
			t.Fatal(err)
		}
		if err := pc.Publish(); err == nil {
			t.Fatal("second publish")
		}
		got, ok := stack.hub.cities[identity.CityID]
		if !ok || got.PlayerID != 7 || got.ID != identity.CityID {
			t.Fatal("hub cache", ok, got)
		}
		var farms, halls int
		bTab := pgx.Identifier{stack.profile.SchemaName, "city_building"}.Sanitize()
		if err := stack.pool.QueryRow(ctx, "SELECT count(*) FILTER (WHERE slot_key='farm'), count(*) FILTER (WHERE slot_key='hall') FROM "+bTab+" WHERE server_id=1 AND city_id=$1", identity.CityID).Scan(&farms, &halls); err != nil || farms != 1 || halls != 1 {
			t.Fatal("buildings", farms, halls, err)
		}
		pc.Close()
		if pc.gateHeld {
			t.Fatal("gate held after close")
		}
		pc2, err := stack.source.Prepare(ctx, initial)
		if err != nil {
			t.Fatal("gate not released", err)
		}
		pc2.Close()
	})

	t.Run("rollback_no_dom_rows", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		stack := preparedCityStageStack(t, ctx)
		pc, err := stack.source.Prepare(ctx, initial)
		if err != nil {
			t.Fatal(err)
		}
		defer pc.Close()
		o, a := recruitWalletBegin(t, ctx, stack.binding)
		_, init, at := preparedCityStageWorldMil(ctx, t, stack, a)
		preparedCityStageDOM(ctx, t, stack, a, pc)
		id, err := pc.Stage(ctx, a, init, at)
		if err != nil {
			t.Fatal(err)
		}
		if err := o.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
		rows := preparedCityStageDOMRows(ctx, t, stack, id.CityID)
		if rows != 0 {
			t.Fatal("checkpoint survived rollback", rows)
		}
		if len(stack.hub.cities) != 0 {
			t.Fatal("hub published without commit")
		}
	})

	t.Run("consume_then_insert_failure_tx_rollback", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		stack := preparedCityStageStack(t, ctx)
		pc, err := stack.source.Prepare(ctx, initial)
		if err != nil {
			t.Fatal(err)
		}
		defer pc.Close()
		o, a := recruitWalletBegin(t, ctx, stack.binding)
		_, init, at := preparedCityStageWorldMil(ctx, t, stack, a)
		preparedCityStageDOM(ctx, t, stack, a, pc)
		bTab := pgx.Identifier{stack.profile.SchemaName, "city_building"}.Sanitize()
		if _, err := a.Exec(ctx, stack.binding, "ALTER TABLE "+bTab+" RENAME TO dropped_city_building"); err != nil {
			t.Fatal(err)
		}
		if _, err := pc.Stage(ctx, a, init, at); err == nil {
			t.Fatal("stage admitted after consume with dead building table")
		}
		if pc.stagedOnce.Load() {
			t.Fatal("stagedOnce set on failed stage")
		}
		if _, err := init.Consume(ctx, a); !errors.Is(err, march.ErrInitializedCityProof) {
			t.Fatalf("double consume want %v got %v", march.ErrInitializedCityProof, err)
		}
		if err := o.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
		cpTab := pgx.Identifier{stack.profile.SchemaName, "city_production_checkpoint"}.Sanitize()
		var domRows int
		if err := stack.pool.QueryRow(ctx, "SELECT count(*) FROM "+cpTab).Scan(&domRows); err != nil || domRows != 0 {
			t.Fatal("dom checkpoint after failed stage rollback", domRows, err)
		}
		if !stack.source.state.retired.Load() {
			t.Fatal("catalog fault did not retire source")
		}
		fresh := preparedCityStageStack(t, ctx)
		o2, a2 := recruitWalletBegin(t, ctx, fresh.binding)
		_, init2, at2 := preparedCityStageWorldMil(ctx, t, fresh, a2)
		pc2, err := fresh.source.Prepare(ctx, initial)
		if err != nil {
			t.Fatal(err)
		}
		defer pc2.Close()
		preparedCityStageDOM(ctx, t, fresh, a2, pc2)
		if _, err := pc2.Stage(ctx, a2, init2, at2); err != nil {
			t.Fatal("recovery stage", err)
		}
		if err := o2.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	})
}
