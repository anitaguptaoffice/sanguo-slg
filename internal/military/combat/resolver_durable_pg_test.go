package combat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func arrivalPGOK(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func arrivalPGSQL(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	_, err := pool.Exec(context.Background(), sql, args...)
	arrivalPGOK(t, err)
}

// Reuse the reviewed schema bodies, not handwritten approximations of the DDL.
// This disposable fixture is not an approved production source profile.
func arrivalPGFixture(t *testing.T) (*pgxpool.Pool, *pgx.Conn, freshsource.Profile) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PostgreSQL 17 DATABASE_URL required")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, dsn)
	arrivalPGOK(t, err)
	t.Cleanup(func() { _ = admin.Close(ctx) })
	var version int
	arrivalPGOK(t, admin.QueryRow(ctx, `SELECT current_setting('server_version_num')::int`).Scan(&version))
	if version < 170000 || version >= 180000 {
		t.Fatalf("requires PostgreSQL 17, got %d", version)
	}
	schema := fmt.Sprintf("arrival_pg_%d", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
	arrivalPGOK(t, err)
	t.Cleanup(func() {
		_, err := admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		if err != nil {
			t.Error(err)
		}
	})
	cfg, err := pgxpool.ParseConfig(dsn)
	arrivalPGOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	arrivalPGOK(t, err)
	t.Cleanup(pool.Close)
	for _, path := range []string{"004_military.sql", "m4_009_march_identity.sql", "005_hero.sql"} {
		body, err := os.ReadFile("../../../spec/db/" + path)
		arrivalPGOK(t, err)
		arrivalPGSQL(t, pool, string(body))
	}
	_, err = admin.Exec(ctx, "SET search_path TO "+pgx.Identifier{schema}.Sanitize())
	arrivalPGOK(t, err)
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-test", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	arrivalPGOK(t, admin.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID))
	var object freshsource.ObjectIdentity
	arrivalPGOK(t, admin.QueryRow(ctx, `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname='march_order'`, p.SchemaOID).Scan(&object.OID, &object.OwnerOID))
	p.Objects["march_order"] = object
	return pool, admin, p
}

// Independent connection observes committed rows; sequence gaps are permitted.
func arrivalPGSnapshot(t *testing.T, conn *pgx.Conn, tables ...string) string {
	t.Helper()
	var parts []string
	for _, table := range tables {
		var part string
		arrivalPGOK(t, conn.QueryRow(context.Background(), `SELECT COALESCE(string_agg(row_to_json(t)::text||':'||xmin::text||':'||ctid::text,'|' ORDER BY row_to_json(t)::text),'') FROM `+pgx.Identifier{table}.Sanitize()+` t`).Scan(&part))
		parts = append(parts, part)
	}
	return strings.Join(parts, ";")
}

func TestPGDurableResolverHubRestore(t *testing.T) {
	for _, scenario := range []string{"battle", "no-battle", "all-dead", "sql-failure", "outer-commit-failure"} {
		t.Run(scenario, func(t *testing.T) {
			pool, observer, profile := arrivalPGFixture(t)
			ctx := context.Background()
			now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
			arrive := now.Add(-time.Second) // overdue; return ETA must not restart at now
			count := int32(2000)
			if scenario == "all-dead" {
				count = 1
			}
			arrivalPGSQL(t, pool, `INSERT INTO city_troop VALUES(1,100,1,123,4); INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES(1,500,7,2,0,0,'{11}'); INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,7,1,3);`)
			arrivalPGSQL(t, pool, `INSERT INTO army_troop VALUES(1,500,1,$1)`, count)
			arrivalPGSQL(t, pool, `INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id) VALUES(1,500,500,0,0,5,5,1,$1,$2,1,100)`, arrive.Add(-time.Hour), arrive)
			if scenario == "sql-failure" || scenario == "outer-commit-failure" {
				arrivalPGSQL(t, pool, `CREATE FUNCTION fail_arrival() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'arrival acceptance failpoint' USING ERRCODE='P0001'; END $$`)
				if scenario == "sql-failure" {
					arrivalPGSQL(t, pool, `CREATE TRIGGER fail_arrival BEFORE INSERT ON battle_report FOR EACH ROW EXECUTE FUNCTION fail_arrival()`)
				} else {
					// Fires only at outer COMMIT, after the transition released its savepoint.
					arrivalPGSQL(t, pool, `CREATE CONSTRAINT TRIGGER fail_arrival AFTER UPDATE ON field_army DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_arrival()`)
				}
			}
			service := report.NewService(report.NewPGStore(pool))
			transition, err := march.NewMarchTransition(service, profile)
			arrivalPGOK(t, err)
			garrisons := M2FixtureGarrisons()
			if scenario == "no-battle" {
				garrisons = NewGarrisonTable()
			}
			resolver := NewResolver(1, service, garrisons, nil)
			arrivalPGOK(t, resolver.EnableDurableArrival(pool.BeginTx, transition))
			restore, err := march.NewMarchRestore(ctx, pool, profile)
			arrivalPGOK(t, err)
			hub := march.NewHub(func() time.Time { return now })
			finished := 0
			hub.SetMarchFinishedHandler(func(int64) { finished++ })
			hub.SetMarchArrivalHandler(resolver.HubHandler())
			restored, err := restore.Restore(ctx, hub)
			arrivalPGOK(t, err)
			if len(restored.Marches) != 1 || hub.Tick() != 0 {
				t.Fatal("restore did not stage exactly one arrival")
			}
			beforeOrder, beforeTroops := hub.SnapshotMarch(500)
			beforeDefenders := garrisons.Get(5, 5)
			beforeRows := arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report")
			beforeCity := arrivalPGSnapshot(t, observer, "city_troop")
			arrivalPGOK(t, hub.ActivateRestore())
			if hub.Tick() != 1 {
				t.Fatal("arrival was not processed exactly once")
			}
			order, survivors := hub.SnapshotMarch(500)
			if strings.HasSuffix(scenario, "failure") {
				var pgErr *pgconn.PgError
				if !errors.As(hub.MarchArrivalError(500), &pgErr) || pgErr.Code != "P0001" || pgErr.Message != "arrival acceptance failpoint" {
					t.Fatalf("failpoint not reached: %v", hub.MarchArrivalError(500))
				}
				if !reflect.DeepEqual(order, beforeOrder) || !reflect.DeepEqual(survivors, beforeTroops) || !reflect.DeepEqual(garrisons.Get(5, 5), beforeDefenders) || finished != 0 {
					t.Fatal("failed transaction published memory")
				}
				if arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report") != beforeRows || arrivalPGSnapshot(t, observer, "city_troop") != beforeCity {
					t.Fatal("failed transaction changed committed rows")
				}
				now = now.Add(24 * time.Hour)
				if hub.Tick() != 0 || finished != 0 {
					t.Fatal("quarantined arrival automatically retried or finished")
				}
				return
			}
			if err := hub.MarchArrivalError(500); err != nil {
				t.Fatal(err)
			}
			var status, armyStatus int16
			var deadline *time.Time
			var x, y, reports int
			arrivalPGOK(t, observer.QueryRow(ctx, `SELECT o.status,o.return_finish_at,a.status,a.x,a.y,(SELECT count(*) FROM battle_report) FROM march_order o JOIN field_army a USING(server_id,army_id) WHERE march_id=500`).Scan(&status, &deadline, &armyStatus, &x, &y, &reports))
			rows, err := observer.Query(ctx, `SELECT unit_cfg_id,count FROM army_troop ORDER BY unit_cfg_id`)
			arrivalPGOK(t, err)
			persisted, err := pgx.CollectRows(rows, pgx.RowToStructByPos[march.TroopStack])
			arrivalPGOK(t, err)
			if len(persisted) != len(survivors) || (len(persisted) > 0 && !reflect.DeepEqual(persisted, survivors)) || x != 5 || y != 5 {
				t.Fatalf("SQL survivors/position mismatch: %v %v (%d,%d)", persisted, survivors, x, y)
			}
			if scenario == "all-dead" {
				if len(survivors) != 0 || status != 4 || armyStatus != 1 || deadline != nil || order.Phase != march.PhaseReturned || finished != 1 {
					t.Fatal("annihilation not terminal")
				}
			} else {
				want := *beforeOrder
				arrivalPGOK(t, march.MarkArrived(&want))
				arrivalPGOK(t, march.BeginReturn(&want, arrive))
				if len(survivors) == 0 || status != 3 || armyStatus != 2 || deadline == nil || !deadline.Equal(want.ReturnFinishAt) || !order.ReturnFinishAt.Equal(*deadline) || order.Phase != march.PhaseReturning || finished != 0 {
					t.Fatal("return did not use frozen arrival deadline")
				}
			}
			if scenario == "no-battle" {
				if reports != 0 || order.LastReportID != 0 || !reflect.DeepEqual(survivors, beforeTroops) {
					t.Fatal("no-battle lost troops or created report")
				}
			} else {
				if reports != 1 || order.LastReportID != 1 {
					t.Fatal("missing exactly-one durable report")
				}
				record, err := service.Get(ctx, 1, order.LastReportID)
				arrivalPGOK(t, err)
				want := StacksFromArmy(march.DefaultUnitCatalog(), record.Detail.FinalAttacker)
				if record.AttackerPlayerID != 7 || record.LocationX != 5 || record.LocationY != 5 || !reflect.DeepEqual(want, survivors) {
					t.Fatal("report and survivors disagree")
				}
			}
			// New Hub/resolver restores persisted state without replaying the battle.
			beforeRestart := arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report")
			restarted := march.NewHub(func() time.Time { return now })
			restarted.RegisterCity(&march.CityState{ID: 100, PlayerID: 7, Troops: map[int32]int32{1: 123}})
			restartFinished := 0
			restarted.SetMarchFinishedHandler(func(int64) { restartFinished++ })
			calls := 0
			freshResolver := NewResolver(1, service, M2FixtureGarrisons(), nil)
			arrivalPGOK(t, freshResolver.EnableDurableArrival(pool.BeginTx, transition))
			restarted.SetMarchArrivalHandler(func(ctx context.Context, ev march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
				calls++
				return freshResolver.HubHandler()(ctx, ev)
			})
			result, err := restore.Restore(ctx, restarted)
			arrivalPGOK(t, err)
			if scenario == "all-dead" {
				if len(result.Marches) != 0 || restarted.March(500) != nil {
					t.Fatal("restored terminal arrival")
				}
			} else {
				reloaded, troops := restarted.SnapshotMarch(500)
				if len(result.Marches) != 1 || reloaded.Phase != march.PhaseReturning || !reloaded.ReturnFinishAt.Equal(*deadline) || !reflect.DeepEqual(troops, survivors) {
					t.Fatal("restart lost durable return")
				}
			}
			arrivalPGOK(t, restarted.ActivateRestore())
			now = now.Add(24 * time.Hour)
			wantReturns := 1
			if scenario == "all-dead" {
				wantReturns = 0
			}
			if restarted.Tick() != wantReturns || restartFinished != wantReturns {
				t.Fatal("restart did not process exactly the persisted return")
			}
			if restarted.Tick() != 0 || calls != 0 || arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report") != beforeRestart || arrivalPGSnapshot(t, observer, "city_troop") != beforeCity {
				t.Fatal("restart replayed combat or wrote persistent return/city credit")
			}
		})
	}
}

// The arrival process exits without deferred cleanup after acknowledged COMMIT.
// Its successor has no shared Go memory, only the same isolated test database.
func TestPGDurableResolverProcessRestart(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	if raw := os.Getenv("ARRIVAL_PROCESS_PROFILE"); raw != "" {
		var profile freshsource.Profile
		arrivalPGOK(t, json.Unmarshal([]byte(raw), &profile))
		cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
		arrivalPGOK(t, err)
		cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{profile.SchemaName}.Sanitize()
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		arrivalPGOK(t, err)
		defer pool.Close()
		hub := march.NewHub(func() time.Time { return now })
		service := report.NewService(report.NewPGStore(pool))
		transition, err := march.NewMarchTransition(service, profile)
		arrivalPGOK(t, err)
		resolver := NewResolver(1, service, M2FixtureGarrisons(), nil)
		arrivalPGOK(t, resolver.EnableDurableArrival(pool.BeginTx, transition))
		calls := 0
		hub.SetMarchArrivalHandler(func(ctx context.Context, ev march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
			calls++
			return resolver.HubHandler()(ctx, ev)
		})
		restore, err := march.NewMarchRestore(ctx, pool, profile)
		arrivalPGOK(t, err)
		result, err := restore.Restore(ctx, hub)
		arrivalPGOK(t, err)
		if len(result.Marches) != 1 {
			t.Fatal("missing live march")
		}
		arrivalPGOK(t, hub.ActivateRestore())
		if os.Getenv("ARRIVAL_PROCESS_PHASE") == "commit" {
			if hub.Tick() != 1 || calls != 1 || hub.MarchArrivalError(500) != nil || hub.March(500).Phase != march.PhaseReturning {
				t.Fatal("arrival not committed")
			}
			os.Exit(17) // Deliberate abrupt process exit after commit; no pool cleanup.
		}
		order, troops := hub.SnapshotMarch(500)
		var deadline time.Time
		arrivalPGOK(t, pool.QueryRow(ctx, "SELECT return_finish_at FROM march_order WHERE march_id=500").Scan(&deadline))
		if order.Phase != march.PhaseReturning || len(troops) == 0 || !order.ReturnFinishAt.Equal(deadline) || hub.Tick() != 0 || calls != 0 {
			t.Fatal("new process lost frozen return or replayed arrival")
		}
		return
	}
	pool, observer, profile := arrivalPGFixture(t)
	arrive := now.Add(-time.Second)
	arrivalPGSQL(t, pool, `INSERT INTO city_troop VALUES(1,100,1,123,4); INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES(1,500,7,2,0,0,'{11}'); INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,7,1,3); INSERT INTO army_troop VALUES(1,500,1,2000)`)
	arrivalPGSQL(t, pool, `INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id) VALUES(1,500,500,0,0,5,5,1,$1,$2,1,100)`, arrive.Add(-time.Hour), arrive)
	raw, err := json.Marshal(profile)
	arrivalPGOK(t, err)
	stock := arrivalPGSnapshot(t, observer, "city_troop")
	var committed string
	for _, phase := range []string{"commit", "restore"} {
		cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestPGDurableResolverProcessRestart$", "-test.v")
		cmd.Env = append(os.Environ(), "ARRIVAL_PROCESS_PROFILE="+string(raw), "ARRIVAL_PROCESS_PHASE="+phase, "GORACE=halt_on_error=1 exitcode=66 log_path=stderr")
		out, err := cmd.CombinedOutput()
		t.Logf("%s child output: %s", phase, out)
		if strings.Contains(string(out), "WARNING: DATA RACE") {
			t.Fatalf("child race detected: %s", out)
		}
		if cmd.ProcessState != nil {
			t.Logf("%s child pid=%d parent pid=%d", phase, cmd.ProcessState.Pid(), os.Getpid())
		}
		if phase == "commit" {
			var exit *exec.ExitError
			if !errors.As(err, &exit) || exit.ExitCode() != 17 {
				t.Fatalf("commit process: %v %s", err, out)
			}
			committed = arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report")
		} else if err != nil || arrivalPGSnapshot(t, observer, "march_order", "field_army", "army_troop", "battle_report") != committed {
			t.Fatalf("restore process changed committed state: %v %s", err, out)
		}
		if arrivalPGSnapshot(t, observer, "city_troop") != stock {
			t.Fatal("process restart changed persistent city stock")
		}
	}
}
