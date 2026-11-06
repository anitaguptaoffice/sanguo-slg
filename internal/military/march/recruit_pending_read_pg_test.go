package march

import (
	"context"
	"errors"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGRecruitPendingReadRawSnapshot(t *testing.T) {
	catalog, active, waiting := preparePending(t)
	_, b, p := completionPG(t, active, waiting)
	for _, tc := range []struct {
		name, sql string
		total     int
	}{
		{"valid", "", 2},
		{"wrong owner", `UPDATE work_queue SET player_id=2 WHERE queue_id=41`, 2},
		{"malformed payload", `UPDATE work_queue SET payload='{"v":0}' WHERE queue_id=41`, 2},
		{"reserved capacity", `UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`, 2},
		{"missing evidence", `DELETE FROM mil_recruit_receipt WHERE queue_id=41`, 2},
		{"complete raw set", `INSERT INTO work_queue SELECT 1,g,2,100,3,'{"v":0}'::jsonb,start_at,finish_at,0 FROM work_queue CROSS JOIN generate_series(42,640) g WHERE queue_id=41`, 601},
	} {
		t.Run(tc.name, func(t *testing.T) {
			o, a, ctx, participant := completionParticipant(t, b, p, catalog)
			if tc.sql != "" {
				execPrep(t, ctx, a, b, tc.sql)
			}
			before := prepareRowsHash(t, ctx, a, b, p)
			seqs := prepareSequences(t, ctx, a, b, p)
			scope := recruitScope{server: 1, player: 1, city: 100}
			x, err := readRecruitPending(ctx, a, participant.source, scope)
			baseOK(t, err)
			if len(x.stock) != 4 || len(x.ids) != tc.total || x.ids[0] != 40 || x.ids[tc.total-1] != int64(39+tc.total) || x.statuses[0] != 1 || x.statuses[1] != 0 || !x.starts[0].Equal(active.qstart) || !x.finishes[1].Equal(waiting.qfinish) {
				t.Fatalf("incomplete raw snapshot: %#v", x)
			}
			if tc.name == "wrong owner" && x.players[1] != 2 || tc.name == "malformed payload" && x.payloads[1] != `{"v": 0}` || tc.name == "reserved capacity" && x.stock[0].ready != 2147483647 {
				t.Fatal("invalid raw fields hidden")
			}
			if tc.name == "complete raw set" {
				for i := 2; i < len(x.ids); i++ {
					if x.ids[i] != int64(40+i) || x.players[i] != 2 || x.payloads[i] != `{"v": 0}` {
						t.Fatalf("raw pending row %d hidden or reordered", i)
					}
				}
			}
			x.stock[0].ready, x.ids[0], x.players[0], x.statuses[0], x.payloads[0] = -1, -1, -1, -1, "changed"
			x.starts[0], x.finishes[0] = time.Time{}, time.Time{}
			y, err := readRecruitPending(ctx, a, participant.source, scope)
			baseOK(t, err)
			if y.stock[0].ready < 0 || y.ids[0] != 40 || y.players[0] != 1 || y.statuses[0] != 1 || y.payloads[0] == "changed" || !y.starts[0].Equal(active.qstart) || !y.finishes[0].Equal(active.qfinish) {
				t.Fatal("snapshot mutation escaped into later read")
			}
			if tc.sql != "" {
				adm, err := participant.Prepare(ctx, a, RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 1})
				if adm != nil || !errors.Is(err, ErrRecruitUnavailable) {
					t.Fatalf("Prepare accepted invalid pending: %v", err)
				}
			}
			if before != prepareRowsHash(t, ctx, a, b, p) || !reflect.DeepEqual(seqs, prepareSequences(t, ctx, a, b, p)) {
				t.Fatal("pending read or rejected Prepare wrote rows/allocated IDs")
			}
			baseOK(t, o.Rollback(ctx))
		})
	}
}

func TestPGRecruitPendingReadRejects(t *testing.T) {
	catalog, _, _ := preparePending(t)
	_, b, p := completionPG(t)
	for _, tc := range []struct{ name, sql string }{
		{"missing marker", `DELETE FROM mil_city_origin`},
		{"wrong owner", `UPDATE mil_city_origin SET owner_player_id=2`},
		{"wrong cohort", `UPDATE mil_city_origin SET cohort_id=decode(repeat('04',16),'hex')`},
		{"missing stock", `DELETE FROM city_troop WHERE unit_cfg_id=4`},
		{"extra stock", `INSERT INTO city_troop VALUES(1,100,5,0,0)`},
		{"SQL failure after stock", `ALTER TABLE work_queue RENAME TO hidden_queue`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			o, a, ctx, participant := completionParticipant(t, b, p, catalog)
			execPrep(t, ctx, a, b, tc.sql)
			x, err := readRecruitPending(ctx, a, participant.source, recruitScope{server: 1, player: 1, city: 100})
			if !errors.Is(err, ErrRecruitUnavailable) || !reflect.DeepEqual(x, recruitPendingSnapshot{}) {
				t.Fatalf("error returned usable snapshot: %#v, %v", x, err)
			}
			if tc.name == "SQL failure after stock" && !participant.source.retired.Load() {
				t.Fatal("definitive source failure did not retire source")
			}
			baseOK(t, o.Rollback(ctx))
		})
	}
}

func TestPGRecruitPendingReadAccess(t *testing.T) {
	catalog, _, _ := preparePending(t)
	pool, b, p := completionPG(t)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	check := func(ctx context.Context, access *recruittx.Access, source *freshMilitarySource) {
		t.Helper()
		x, err := readRecruitPending(ctx, access, source, recruitScope{server: 1, player: 1, city: 100})
		if !errors.Is(err, ErrRecruitUnavailable) || !reflect.DeepEqual(x, recruitPendingSnapshot{}) {
			t.Fatalf("invalid access/source returned snapshot: %#v, %v", x, err)
		}
	}
	check(wctx, wa, participant.source)
	baseOK(t, wo.Rollback(wctx))
	check(ctx, nil, participant.source)
	check(ctx, a, nil)
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	check(cancelled, a, participant.source)
	baseOK(t, o.Rollback(ctx))
	check(ctx, a, participant.source)
	o, a, ctx = baseOwner(t, b)
	participant.source.retired.Store(true)
	check(ctx, a, participant.source)
	baseOK(t, o.Rollback(ctx))
}

func TestPGRecruitPendingReadRetainsLocks(t *testing.T) {
	catalog, active, waiting := preparePending(t)
	pool, b, p := completionPG(t, active, waiting)
	marker, ma, mctx := baseOwner(t, b)
	receipt, ra, rctx := baseOwner(t, b)
	var one, blocker, pid int32
	baseOK(t, ma.Scan(mctx, b, `SELECT pg_catalog.pg_backend_pid() FROM mil_city_origin WHERE city_id=100 FOR UPDATE`, nil, &blocker))
	baseOK(t, ra.Scan(rctx, b, `SELECT 1 FROM mil_recruit_receipt WHERE queue_id=40 FOR UPDATE`, nil, &one))
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid))
	done := make(chan error, 1)
	go func() {
		_, err := readRecruitPending(ctx, a, participant.source, recruitScope{server: 1, player: 1, city: 100})
		done <- err
	}()
	consumed := false
	t.Cleanup(func() {
		_ = marker.Rollback(mctx)
		_ = receipt.Rollback(rctx)
		if !consumed {
			select {
			case <-done:
			case <-time.After(10 * time.Second):
				t.Error("pending reader did not finish after blockers ended")
			}
		}
	})
	probe := func(q string, want bool) {
		t.Helper()
		if prepareProbeLocked(t, pool, q) != want {
			t.Fatalf("row locked != %t: %s", want, q)
		}
	}
	stock := "SELECT count FROM city_troop WHERE server_id=1 AND city_id=100 AND unit_cfg_id="
	queue := "SELECT status FROM work_queue WHERE server_id=1 AND queue_id="
	waitPrepareBlocked(t, pool, pid, blocker)
	probe(stock+"1", false)
	probe(queue+"40", false)
	baseOK(t, marker.Rollback(mctx))
	select {
	case err := <-done:
		consumed = true
		baseOK(t, err)
	case <-time.After(10 * time.Second):
		t.Fatal("pending read blocked on receipt")
	}
	baseOK(t, receipt.Rollback(rctx))
	for _, want := range []bool{true, false} {
		probe("SELECT owner_player_id FROM mil_city_origin WHERE server_id=1 AND city_id=100", want)
		for unit := 1; unit <= 4; unit++ {
			probe(stock+strconv.Itoa(unit), want)
		}
		for id := 40; id <= 41; id++ {
			probe(queue+strconv.Itoa(id), want)
			probe("SELECT player_id FROM mil_recruit_origin WHERE queue_id="+strconv.Itoa(id), false)
			probe("SELECT count FROM mil_recruit_receipt WHERE queue_id="+strconv.Itoa(id), false)
		}
		if want {
			baseOK(t, o.Commit(ctx))
		}
	}
}
