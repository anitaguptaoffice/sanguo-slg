package march

import (
	"context"
	"errors"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

const returnLockedSeed = `UPDATE march_order SET origin_city_id=100,status=3,depart_at='2026-01-02 03:03:05.123456+00',arrive_at='2026-01-02 03:04:05.123456+00',return_finish_at='2026-01-02 03:05:05.123456+00'; UPDATE field_army SET status=2,x=1,y=1,hero_ids=ARRAY[1,9007199254740992]::bigint[]; INSERT INTO army_troop VALUES(1,1,4,9),(1,1,2,8),(1,1,3,6)`

func TestPGReturnLockedStates(t *testing.T) {
	pool, b, profile := returnSourceFixture(t)
	baseSQL(t, pool, returnLockedSeed)
	catalog, _, _ := preparePending(t)
	for _, tc := range []struct {
		sql  string
		want returnPhase
	}{
		{"", returnReturning},
		{"UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0", returnCredited},
		{"UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", returnAnnihilated},
		{"UPDATE march_order SET army_id=2", 0}, {"UPDATE march_order SET origin_city_id=NULL", 0}, {"UPDATE march_order SET origin_city_id=101", 0},
		{"DELETE FROM march_order", 0}, {"DELETE FROM field_army", 0}, {"UPDATE field_army SET owner_player_id=2", 0},
		{"UPDATE march_order SET server_id=2", 0}, {"UPDATE field_army SET server_id=2", 0}, {"UPDATE army_troop SET server_id=2", 0},
		{"UPDATE march_order SET from_x=1", 0}, {"UPDATE march_order SET to_y=500", 0}, {"UPDATE field_army SET x=0", 0},
		{"UPDATE march_order SET status=2", 0}, {"UPDATE field_army SET status=3", 0}, {"UPDATE march_order SET purpose=4", 0},
		{"UPDATE march_order SET depart_at=arrive_at", 0}, {"UPDATE march_order SET return_finish_at=arrive_at", 0}, {"UPDATE march_order SET return_finish_at=NULL", 0}, {"UPDATE march_order SET return_finish_at='infinity'", 0},
		{"UPDATE field_army SET hero_ids='{}'", 0}, {"UPDATE field_army SET hero_ids=ARRAY[1,1]", 0}, {"UPDATE field_army SET hero_ids=ARRAY[0]", 0}, {"UPDATE field_army SET hero_ids=ARRAY[-1]", 0}, {"UPDATE field_army SET hero_ids=ARRAY[NULL]::bigint[]", 0},
		{"UPDATE army_troop SET count=0 WHERE unit_cfg_id=1", 0}, {"UPDATE army_troop SET unit_cfg_id=5 WHERE unit_cfg_id=4", 0}, {"DELETE FROM army_troop", 0},
		{"UPDATE march_order SET status=4; UPDATE field_army SET status=1", 0}, {"UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0; DELETE FROM army_troop", 0},
		{"UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1", 0},
		{"DELETE FROM city_troop WHERE unit_cfg_id=4", 0}, {"INSERT INTO city_troop VALUES(1,100,5,0,0)", 0}, {"UPDATE city_troop SET unit_cfg_id=5 WHERE unit_cfg_id=4", 0},
		{"UPDATE mil_city_origin SET owner_player_id=2", 0}, {"DELETE FROM mil_city_origin", 0},
		{"UPDATE mil_city_origin SET cohort_id=decode(repeat('04',16),'hex')", 0},
		{"ALTER TABLE city_troop DROP CONSTRAINT city_troop_count_check; UPDATE city_troop SET count=-1", 0},
		{"ALTER TABLE city_troop DROP CONSTRAINT city_troop_wounded_check; UPDATE city_troop SET wounded=-1", 0},
	} {
		t.Run(tc.sql, func(t *testing.T) {
			o, a, ctx := baseOwner(t, b)
			p, err := NewReturnParticipant(ctx, b, a, profile, catalog)
			baseOK(t, err)
			baseOK(t, p.Pin(ctx, a))
			execPrep(t, ctx, a, b, `UPDATE work_queue SET player_id=2,payload='{"v":0}'; DELETE FROM mil_recruit_receipt; UPDATE city_troop SET count=2147483647,wounded=2147483647`)
			if tc.sql != "" {
				execPrep(t, ctx, a, b, tc.sql)
			}
			snapshot := func() []string {
				out := []string{prepareRowsHash(t, ctx, a, b, profile)}
				for _, name := range []string{"march_order", "field_army", "army_troop"} {
					var row string
					baseOK(t, a.Scan(ctx, b, "SELECT COALESCE(jsonb_agg(jsonb_build_array(t,t.xmin::text,t.ctid::text) ORDER BY t.ctid)::text,'') FROM "+p.source.table(name)+" t", nil, &row))
					out = append(out, row)
				}
				var settings string
				baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.string_agg(name||'='||setting,',' ORDER BY name) FROM pg_catalog.pg_settings", nil, &settings))
				return append(out, settings)
			}
			before, seqs := snapshot(), prepareSequences(t, ctx, a, b, profile)
			got, err := p.returnLocked(ctx, a, ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0})
			if tc.want == 0 {
				if !errors.Is(err, ErrReturnUnavailable) || !reflect.DeepEqual(got, returnLockedSnapshot{}) {
					t.Fatal("malformed state returned usable snapshot", got, err)
				}
				if (tc.sql == "DELETE FROM march_order" || tc.sql == "DELETE FROM field_army") && !errors.Is(err, pgx.ErrNoRows) {
					t.Fatal("missing-row cause lost", err)
				}
			} else {
				baseOK(t, err)
				if got.phase != tc.want || len(got.pending.ids) != 2 || got.pending.players[0] != 2 || got.pending.stock[0].wounded != 2147483647 || got.pending.payloads[0] != `{"v": 0}` {
					t.Fatal("state or raw pending lost", got)
				}
				if got.arrive.Location() != time.UTC || got.arrive.Nanosecond() != 123456000 || tc.want != returnAnnihilated && (got.returnAt == nil || got.returnAt.Location() != time.UTC || got.returnAt.Nanosecond() != 123456000) {
					t.Fatal("retained instant changed", got)
				}
				got.heroes[0], got.pending.ids[0], got.pending.stock[0].ready = -1, -1, -1
				if got.returnAt != nil {
					*got.returnAt, got.units[0], got.counts[0] = time.Time{}, -1, -1
				}
				copy, err := p.returnLocked(ctx, a, ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0})
				baseOK(t, err)
				if copy.heroes[0] != 1 || copy.pending.ids[0] != 40 || copy.pending.stock[0].ready != 2147483647 ||
					tc.want != returnAnnihilated && (copy.units[0] != 1 || copy.counts[0] != 7 || copy.returnAt.IsZero()) {
					t.Fatal("snapshot aliases persisted state")
				}
			}
			if !reflect.DeepEqual(before, snapshot()) || !reflect.DeepEqual(seqs, prepareSequences(t, ctx, a, b, profile)) {
				t.Fatal("rows, sequences or settings changed")
			}
			baseOK(t, o.Rollback(ctx))
		})
	}
}

func TestPGReturnLockedAccess(t *testing.T) {
	pool, b, profile := returnSourceFixture(t)
	baseSQL(t, pool, returnLockedSeed)
	catalog, _, _ := preparePending(t)
	o, a, ctx := baseOwner(t, b)
	p, err := NewReturnParticipant(ctx, b, a, profile, catalog)
	baseOK(t, err)
	baseOK(t, p.Pin(ctx, a))
	check := func(ctx context.Context, a *recruittx.Access, cause error) {
		t.Helper()
		x, err := p.returnLocked(ctx, a, ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0})
		if (!errors.Is(err, cause) && !(cause == recruittx.ErrInactive && errors.Is(err, context.Canceled))) || !reflect.DeepEqual(x, returnLockedSnapshot{}) {
			t.Fatal("access returned usable snapshot or lost cause", err)
		}
	}
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	check(wctx, wa, recruittx.ErrBinding)
	baseOK(t, wo.Rollback(wctx))
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	check(cancelled, a, context.Canceled)
	copyAccess := *a
	*a = *wa // Replacing caller storage must not rebind its previously copied Access.
	_, err = p.returnLocked(ctx, &copyAccess, ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0})
	baseOK(t, err)
	*a = copyAccess
	for i := 0; i < 4; i++ {
		for _, id := range []int64{0, -1, marchIDCeiling + 1} {
			c := ReturnCandidate{1, 1, 100, 1, 1}
			ids := []*int64{&c.PlayerID, &c.CityID, &c.MarchID, &c.ArmyID}
			*ids[i] = id
			x, err := p.returnLocked(ctx, a, c, ReturnOrigin{1, 1, 100, 0, 0})
			if !errors.Is(err, ErrReturnUnavailable) || !reflect.DeepEqual(x, returnLockedSnapshot{}) {
				t.Fatal("unsafe candidate returned snapshot", c, err)
			}
		}
	}
	for _, origin := range []ReturnOrigin{{2, 1, 100, 0, 0}, {1, 2, 100, 0, 0}, {1, 1, 101, 0, 0}, {1, 1, 100, 1, 0}} {
		x, err := p.returnLocked(ctx, a, ReturnCandidate{1, 1, 100, 1, 1}, origin)
		if !errors.Is(err, ErrReturnUnavailable) || !reflect.DeepEqual(x, returnLockedSnapshot{}) {
			t.Fatal("foreign origin returned snapshot", origin, err)
		}
	}
	baseOK(t, o.Commit(ctx))
	check(context.Background(), &copyAccess, recruittx.ErrInactive)
	o, a, ctx = baseOwner(t, b)
	baseOK(t, p.Pin(ctx, a))
	copySource := *p
	execPrep(t, ctx, a, b, "ALTER TABLE army_troop ENABLE ROW LEVEL SECURITY")
	check(ctx, a, ErrReturnSource)
	if !copySource.source.retired.Load() {
		t.Fatal("definite source drift did not retire participant copies")
	}
	baseOK(t, o.Rollback(ctx))
	_, a, ctx = baseOwner(t, b)
	p = &copySource
	check(ctx, a, ErrReturnSource)
}

func TestPGReturnLockedOrder(t *testing.T) {
	pool, b, profile := returnSourceFixture(t)
	baseSQL(t, pool, returnLockedSeed)
	catalog, _, _ := preparePending(t)
	o, a, ctx := baseOwner(t, b)
	p, err := NewReturnParticipant(ctx, b, a, profile, catalog)
	baseOK(t, err)
	baseOK(t, p.Pin(ctx, a))
	queries := []string{"SELECT 1 FROM mil_city_origin WHERE city_id=100"}
	for i := 1; i <= 4; i++ {
		queries = append(queries, "SELECT 1 FROM city_troop WHERE city_id=100 AND unit_cfg_id="+strconv.Itoa(i))
	}
	queries = append(queries, "SELECT 1 FROM work_queue WHERE queue_id=40", "SELECT 1 FROM work_queue WHERE queue_id=41", "SELECT 1 FROM march_order WHERE march_id=1", "SELECT 1 FROM field_army WHERE army_id=1")
	for i := 1; i <= 4; i++ {
		queries = append(queries, "SELECT 1 FROM army_troop WHERE army_id=1 AND unit_cfg_id="+strconv.Itoa(i))
	}
	var blockers []*pgx.Conn
	for _, q := range append(append([]string{}, queries...), "SELECT 1 FROM mil_recruit_receipt", "SELECT 1 FROM mil_recruit_origin") {
		conn, err := pgx.ConnectConfig(ctx, pool.Config().ConnConfig.Copy())
		baseOK(t, err)
		t.Cleanup(func() {
			clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			_ = conn.Close(clean)
		})
		_, err = conn.Exec(ctx, "BEGIN;"+q+" FOR UPDATE")
		baseOK(t, err)
		blockers = append(blockers, conn)
	}
	var pid int32
	baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
	run, cancel := context.WithCancel(ctx)
	done, finished := make(chan error, 1), make(chan struct{})
	go func() {
		defer close(finished)
		_, err := p.returnLocked(run, a, ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0})
		done <- err
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-finished:
		case <-time.After(5 * time.Second):
			t.Error("loader did not stop")
		}
	})
	for i, q := range queries {
		waitPrepareBlocked(t, pool, pid, int32(blockers[i].PgConn().PID()))
		for _, earlier := range queries[:i] {
			if !prepareProbeLocked(t, pool, earlier) {
				t.Fatal("earlier lock released", earlier, q)
			}
		}
		locks := prepareLocks(t, pool, profile.SchemaOID, pid)
		if len(locks) != 1 {
			t.Fatal("unexpected simultaneous row waits", locks)
		}
		_, err := blockers[i].Exec(ctx, "ROLLBACK")
		baseOK(t, err)
	}
	select {
	case err := <-done:
		baseOK(t, err)
	case <-ctx.Done():
		t.Fatal("reverse evidence lock", ctx.Err())
	}
	for _, conn := range blockers[len(queries):] {
		_, err := conn.Exec(ctx, "ROLLBACK")
		baseOK(t, err)
	}
	for _, want := range []bool{true, false} {
		for _, q := range queries {
			if prepareProbeLocked(t, pool, q) != want {
				t.Fatal("lock lifetime", q, want)
			}
		}
		if want {
			baseOK(t, o.Commit(ctx))
		}
	}
}
