package march

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

var returnAtomicCandidate = ReturnCandidate{1, 1, 100, 1, 1}
var returnAtomicOrigin = ReturnOrigin{1, 1, 100, 0, 0}

func returnAtomicFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile, *completionTrace) {
	t.Helper()
	pool, _, profile := returnSourceFixture(t)
	baseSQL(t, pool, returnLockedSeed)
	cfg, trace := pool.Config(), &completionTrace{}
	cfg.ConnConfig.Tracer = trace
	observed, err := pgxpool.NewWithConfig(context.Background(), cfg)
	baseOK(t, err)
	t.Cleanup(observed.Close)
	b, err := recruittx.NewBinding(observed)
	baseOK(t, err)
	return observed, b, profile, trace
}

func returnAtomicParticipant(t *testing.T, b *recruittx.Binding, profile freshsource.Profile) (*recruittx.Owner, *recruittx.Access, context.Context, *ReturnParticipant) {
	t.Helper()
	o, a, ctx := baseOwner(t, b)
	catalog, _, _ := preparePending(t)
	p, err := NewReturnParticipant(ctx, b, a, profile, catalog)
	baseOK(t, err)
	baseOK(t, p.Pin(ctx, a))
	return o, a, ctx, p
}

// Pool reads use a different connection from either live transaction. Full mode
// includes tuple versions; stable mode masks only the explicitly writable fields.
func returnAtomicState(t *testing.T, pool *pgxpool.Pool, stable bool) string {
	t.Helper()
	var out string
	for _, table := range append(append([]string{}, returnPinTables...), "player_wallet") {
		value := "jsonb_build_array(to_jsonb(t),t.xmin::text,t.ctid::text)"
		if stable {
			switch table {
			case "city_troop":
				value = "to_jsonb(t)-'count'"
			case "march_order":
				value = "to_jsonb(t)-'status'"
			case "field_army":
				value = "to_jsonb(t)-ARRAY['status','x','y']"
			}
		}
		var row string
		baseOK(t, pool.QueryRow(context.Background(), "SELECT COALESCE(jsonb_agg(v ORDER BY v)::text,'') FROM (SELECT "+value+" v FROM "+table+" t) q").Scan(&row))
		out += table + row
	}
	var seq string
	baseOK(t, pool.QueryRow(context.Background(), "SELECT last_value||':'||is_called FROM work_queue_id_seq").Scan(&seq))
	return out + seq
}

func TestPGReturnAtomicDue(t *testing.T) {
	for _, boundary := range []bool{false, true} {
		pool, b, profile, trace := returnAtomicFixture(t)
		want := []int32{12, 8, 6, 9}
		baseSQL(t, pool, "UPDATE city_troop SET wounded=2147483647")
		if boundary {
			baseSQL(t, pool, "UPDATE city_troop SET count=2147483636 WHERE unit_cfg_id=1") // R+P+S = MaxInt32.
			want[0] = 2147483643
		}
		before, stable := returnAtomicState(t, pool, false), returnAtomicState(t, pool, true)
		o, a, ctx, p := returnAtomicParticipant(t, b, profile)
		execPrep(t, ctx, a, b, "SET LOCAL TIME ZONE 'Etc/UTC'")
		got, err := p.Complete(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
		baseOK(t, err)
		due := time.Date(2026, 1, 2, 3, 5, 5, 123456000, time.UTC)
		if got != (ReturnObservation{returnAtomicCandidate, ReturnApplied, due}) || got.ReturnAt.Location() != time.UTC || trace.clock.Load() != 1 || trace.seq.Load() != 0 || trace.late.Load() != 0 || trace.locks.Load() < 6 {
			t.Fatal("provisional observation, clock or allocation", got, trace.clock.Load(), trace.seq.Load())
		}
		if returnAtomicState(t, pool, false) != before {
			t.Fatal("provisional writes escaped outer transaction")
		}
		baseOK(t, o.Commit(ctx))
		var counts []int32
		var march, army, x, y int32
		baseOK(t, pool.QueryRow(ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&counts))
		baseOK(t, pool.QueryRow(ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a").Scan(&march, &army, &x, &y))
		if !reflect.DeepEqual(counts, want) || march != 4 || army != 1 || x != 0 || y != 0 || returnAtomicState(t, pool, true) != stable {
			t.Fatal("credit or retained graph changed", counts, march, army, x, y)
		}
		before = returnAtomicState(t, pool, false)
		o, a, ctx, p = returnAtomicParticipant(t, b, profile)
		trace.clock.Store(0)
		for _, call := range []func(context.Context, *recruittx.Access, ReturnCandidate, ReturnOrigin) (ReturnObservation, error){p.Complete, p.Readback} {
			got, err = call(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
			baseOK(t, err)
			if got != (ReturnObservation{returnAtomicCandidate, ReturnCreditedTerminal, due}) {
				t.Fatal("duplicate terminal", got)
			}
		}
		baseOK(t, o.Commit(ctx))
		if trace.clock.Load() != 0 || returnAtomicState(t, pool, false) != before {
			t.Fatal("terminal wrote or sampled clock")
		}
	}
}

func TestPGReturnAtomicReadOnly(t *testing.T) {
	for _, tc := range []struct {
		name, sql string
		want      ReturnDisposition
		read      bool
	}{
		{"early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", ReturnEarly, false},
		{"credited", "UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0", ReturnCreditedTerminal, false},
		{"annihilation", "UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", ReturnAnnihilatedTerminal, false},
		{"readback", "SELECT 1", ReturnStillReturning, true},
		{"readback early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", ReturnEarly, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, b, profile, trace := returnAtomicFixture(t)
			baseSQL(t, pool, tc.sql+`; UPDATE work_queue SET player_id=2,payload='{"v":0}'; DELETE FROM mil_recruit_receipt; UPDATE city_troop SET count=2147483647`)
			before := returnAtomicState(t, pool, false)
			o, a, ctx, p := returnAtomicParticipant(t, b, profile)
			call := p.Complete
			if tc.read {
				call = p.Readback
			}
			got, err := call(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
			baseOK(t, err)
			var clock int32
			if tc.want == ReturnEarly || tc.want == ReturnStillReturning {
				clock = 1
			}
			if got.Candidate != returnAtomicCandidate || got.Disposition != tc.want || got.ReturnAt.IsZero() != (tc.want == ReturnAnnihilatedTerminal) || trace.clock.Load() != clock || trace.seq.Load() != 0 {
				t.Fatal("read-only classification", got, trace.clock.Load())
			}
			baseOK(t, o.Commit(ctx))
			if returnAtomicState(t, pool, false) != before {
				t.Fatal("read-only branch changed rows or sequence")
			}
		})
	}
}

func TestPGReturnAtomicRejectedEvidence(t *testing.T) {
	for _, sql := range []string{
		"UPDATE work_queue SET player_id=2 WHERE queue_id=41",
		`UPDATE work_queue SET payload='{"v":0}' WHERE queue_id=41`,
		"UPDATE work_queue SET status=1 WHERE queue_id=41",
		"DELETE FROM mil_recruit_receipt WHERE queue_id=41",
		"UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex') WHERE queue_id=41",
		`UPDATE work_queue SET payload=jsonb_set(payload,'{catalog_version}','"unknown"') WHERE queue_id=41; UPDATE mil_recruit_receipt SET catalog_version=convert_to('unknown','UTF8') WHERE queue_id=41`,
		"UPDATE city_troop SET count=2147483640 WHERE unit_cfg_id=1", // R+S fits, R+P+S does not.
		"DELETE FROM army_troop WHERE unit_cfg_id=1; UPDATE city_troop SET count=2147483644 WHERE unit_cfg_id=1", // Non-survivor R+P overflow.
	} {
		t.Run(sql, func(t *testing.T) {
			pool, b, profile, _ := returnAtomicFixture(t)
			baseSQL(t, pool, sql)
			before := returnAtomicState(t, pool, false)
			o, a, ctx, p := returnAtomicParticipant(t, b, profile)
			got, err := p.Complete(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
			if !errors.Is(err, ErrReturnUnavailable) || got != (ReturnObservation{}) {
				t.Fatal("due accepted bad pending/capacity", got, err)
			}
			baseOK(t, o.Rollback(ctx))
			if returnAtomicState(t, pool, false) != before {
				t.Fatal("rejection persisted effects")
			}
		})
	}
}
