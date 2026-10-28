package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func writeSeed(t *testing.T, pool *pgxpool.Pool, p freshsource.Profile) {
	t.Helper()
	prepareBase(t, pool, p)
	_, err := pool.Exec(context.Background(), `INSERT INTO player_wallet VALUES(1,1,500,500,500,500,50,now())`)
	baseOK(t, err)
}

func writeAdmit(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile, catalog *RecruitCatalog) (*RecruitParticipant, *RecruitAdmission) {
	t.Helper()
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	adm, err := participant.Prepare(ctx, a, RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2})
	baseOK(t, err)
	return participant, adm
}

func writeCounts(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding) (int64, int64, int64) {
	t.Helper()
	var q, o, r int64
	baseOK(t, a.Scan(ctx, b, `SELECT (SELECT count(*) FROM work_queue),(SELECT count(*) FROM mil_recruit_origin),(SELECT count(*) FROM mil_recruit_receipt)`, nil, &q, &o, &r))
	return q, o, r
}

func writeZeroRows(t *testing.T, b *recruittx.Binding) {
	t.Helper()
	o, a, ctx := baseOwner(t, b)
	q, org, rec := writeCounts(t, ctx, a, b)
	baseOK(t, o.Rollback(ctx))
	if q != 0 || org != 0 || rec != 0 {
		t.Fatalf("visible rows after rollback: %d %d %d", q, org, rec)
	}
}

func TestPGRecruitWrite(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	writeSeed(t, pool, p)
	catalog, _, _ := recruitSourceCatalog(t)
	evidence, err := catalog.Current(1)
	baseOK(t, err)
	o, a, ctx := baseOwner(t, b)
	participant, adm := writeAdmit(t, ctx, a, b, p, catalog)
	var walletBefore, walletAfter, troopBefore, troopAfter string
	var lastBefore, lastAfter int64
	var calledBefore, calledAfter bool
	baseOK(t, a.Scan(ctx, b, `SELECT row_to_json(w)::text FROM player_wallet w`, nil, &walletBefore))
	baseOK(t, a.Scan(ctx, b, `SELECT string_agg(row_to_json(t)::text,'|' ORDER BY unit_cfg_id) FROM city_troop t`, nil, &troopBefore))
	baseOK(t, a.Scan(ctx, b, `SELECT last_value,is_called FROM work_queue_id_seq`, nil, &lastBefore, &calledBefore))
	want := RecruitAcceptance{QueueID: adm.state.queueID, CityID: 100, UnitCfgID: 1, Count: 2,
		Cost: Resources{Food: 82, Wood: 40}, DurationSeconds: 60, CatalogVersion: evidence.Version(),
		RuleDigest: evidence.Digest(), AcceptedAt: adm.state.acceptedAt, InitialStatus: 1,
		InitialStartAt: adm.state.schedule.start, InitialFinishAt: adm.state.schedule.finish}
	copied := *adm
	got, err := adm.Write(ctx, a)
	baseOK(t, err)
	baseOK(t, a.Scan(ctx, b, `SELECT row_to_json(w)::text FROM player_wallet w`, nil, &walletAfter))
	baseOK(t, a.Scan(ctx, b, `SELECT string_agg(row_to_json(t)::text,'|' ORDER BY unit_cfg_id) FROM city_troop t`, nil, &troopAfter))
	baseOK(t, a.Scan(ctx, b, `SELECT last_value,is_called FROM work_queue_id_seq`, nil, &lastAfter, &calledAfter))
	if got != want || walletBefore != walletAfter || troopBefore != troopAfter || lastBefore != lastAfter || calledBefore != calledAfter {
		t.Fatalf("write=%#v want=%#v wallet=%v troop=%v seq=%d/%d", got, want, walletBefore == walletAfter, troopBefore == troopAfter, lastBefore, lastAfter)
	}
	q, org, rec := writeCounts(t, ctx, a, b)
	if q != 1 || org != 1 || rec != 1 {
		t.Fatalf("rows %d %d %d", q, org, rec)
	}
	hist, err := participant.History(ctx, a, RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}, adm.state.queueID)
	baseOK(t, err)
	if hist != want {
		t.Fatalf("history %#v", hist)
	}
	var queueType, status int16
	baseOK(t, a.Scan(ctx, b, `SELECT queue_type,status FROM work_queue WHERE server_id=1 AND queue_id=$1`, []any{adm.state.queueID}, &queueType, &status))
	var operation int16
	var command []byte
	baseOK(t, a.Scan(ctx, b, `SELECT operation,command_id FROM mil_recruit_origin WHERE server_id=1 AND queue_id=$1`, []any{adm.state.queueID}, &operation, &command))
	if queueType != 3 || status != 1 || operation != 1 || len(command) != 16 {
		t.Fatalf("stored queue/origin %d %d %d %d", queueType, status, operation, len(command))
	}
	if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("second write", err)
	}
	if _, err = copied.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("copy after write", err)
	}
	if _, err = adm.Cost(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("cost after write", err)
	}
	baseOK(t, o.Rollback(ctx))
	writeZeroRows(t, b)
}

func TestPGRecruitWriteWaiting(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	writeSeed(t, pool, p)
	catalog, active, _ := preparePending(t)
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	prepareSeedRow(t, ctx, a, b, active)
	scope, intent := RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	adm, err := participant.Prepare(ctx, a, scope, intent)
	baseOK(t, err)
	evidence, err := catalog.Current(1)
	baseOK(t, err)
	want := RecruitAcceptance{QueueID: adm.state.queueID, CityID: 100, UnitCfgID: 1, Count: 2,
		Cost: Resources{Food: 82, Wood: 40}, DurationSeconds: 60, CatalogVersion: evidence.Version(),
		RuleDigest: evidence.Digest(), AcceptedAt: adm.state.acceptedAt, InitialStatus: 0,
		InitialStartAt: active.qfinish, InitialFinishAt: active.qfinish.Add(time.Minute)}
	got, err := adm.Write(ctx, a)
	baseOK(t, err)
	if got != want || !adm.state.schedule.waiting {
		t.Fatalf("waiting write=%#v want=%#v", got, want)
	}
	hist, err := participant.History(ctx, a, scope, intent, adm.state.queueID)
	baseOK(t, err)
	if hist != want {
		t.Fatalf("waiting history %#v", hist)
	}
	baseOK(t, o.Rollback(ctx))
	writeZeroRows(t, b)
}

func TestPGRecruitWriteRejects(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	writeSeed(t, pool, p)
	catalog, _, _ := recruitSourceCatalog(t)
	t.Run("wrong binding", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		wrong, err := recruittx.NewBinding(pool)
		baseOK(t, err)
		wo, wa, wctx := baseOwner(t, wrong)
		if _, err = adm.Write(wctx, wa); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(err)
		}
		if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("retry after wrong binding", err)
		}
		baseOK(t, o.Rollback(ctx))
		baseOK(t, wo.Rollback(wctx))
		writeZeroRows(t, b)
	})
	t.Run("ended", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		baseOK(t, o.Rollback(ctx))
		if _, err := adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(err)
		}
		writeZeroRows(t, b)
	})
	t.Run("nil access", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		if _, err := adm.Write(ctx, nil); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(err)
		}
		if _, err := adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("retry after nil access", err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
	t.Run("origin conflict", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		_, err := a.Exec(ctx, b, `INSERT INTO mil_recruit_origin VALUES(1,900,1,1,$1)`, adm.state.scope.CommandID[:])
		baseOK(t, err)
		if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("origin conflict accepted", err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
	t.Run("receipt conflict", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		_, err := a.Exec(ctx, b, `INSERT INTO mil_recruit_origin VALUES(1,$1,1,1,$2)`, adm.state.queueID, adm.state.scope.CommandID[:])
		baseOK(t, err)
		_, err = a.Exec(ctx, b, `INSERT INTO mil_recruit_receipt VALUES(1,$1,1,100,1,1,0,0,0,0,60,'v',decode(repeat('aa',32),'hex'),'2026-01-01T00:00:00.123Z','2026-01-01T00:00:00.123Z','2026-01-01T00:01:00.123Z',1)`, adm.state.queueID)
		baseOK(t, err)
		if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("receipt conflict accepted", err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
}

func TestPGRecruitWriteDrift(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	writeSeed(t, pool, p)
	catalog, _, _ := recruitSourceCatalog(t)
	t.Run("source rename", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		if _, err := a.Exec(ctx, b, `ALTER TABLE mil_recruit_receipt RENAME TO moved_receipt`); err != nil {
			t.Fatal(err)
		}
		if _, err := adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
	t.Run("trigger", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		_, err := a.Exec(ctx, b, `CREATE FUNCTION noop_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`)
		baseOK(t, err)
		_, err = a.Exec(ctx, b, `CREATE TRIGGER noop_receipt BEFORE INSERT ON mil_recruit_receipt FOR EACH ROW EXECUTE FUNCTION noop_receipt()`)
		baseOK(t, err)
		if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("trigger drift accepted", err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
	t.Run("receipt insert failure", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		_, adm := writeAdmit(t, ctx, a, b, p, catalog)
		_, err := a.Exec(ctx, b, `CREATE FUNCTION reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$`)
		baseOK(t, err)
		_, err = a.Exec(ctx, b, `CREATE TRIGGER reject_receipt BEFORE INSERT ON mil_recruit_receipt FOR EACH ROW EXECUTE FUNCTION reject_receipt()`)
		baseOK(t, err)
		if _, err = adm.Write(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("injected receipt failure accepted", err)
		}
		baseOK(t, o.Rollback(ctx))
		writeZeroRows(t, b)
	})
}
