package march

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5/pgxpool"
)

func dueSeed(t *testing.T, pool *pgxpool.Pool, h historyRow) {
	t.Helper()
	exec := func(q string, args ...any) { _, err := pool.Exec(context.Background(), q, args...); baseOK(t, err) }
	exec(`INSERT INTO mil_recruit_origin VALUES(1,$1,$2,1,$3)`, h.queueID, h.player, h.command[:])
	exec(`INSERT INTO mil_recruit_receipt VALUES(1,$1,1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, h.queueID, h.qCity, h.count, h.cost.Food, h.cost.Wood, h.cost.Iron, h.cost.Stone, h.duration, h.version, h.digest[:], h.accepted, h.rstart, h.rfinish, h.initial)
	exec(`INSERT INTO work_queue VALUES(1,$1,$2,$3,3,$4,$5,$6,$7)`, h.queueID, h.player, h.qCity, string(h.payload), h.qstart, h.qfinish, h.status)
}

func dueOf(h historyRow) []RecruitDueJob {
	return []RecruitDueJob{{RecruitCandidate: completionCandidate(h), FinishAt: h.qfinish.UTC()}}
}

func dueWorld(t *testing.T, pool *pgxpool.Pool, city, player int64) {
	t.Helper()
	var exists bool
	baseOK(t, pool.QueryRow(context.Background(), `SELECT pg_catalog.to_regclass('player_city') IS NOT NULL`).Scan(&exists))
	if !exists {
		body, err := os.ReadFile("../../../spec/db/002_world.sql")
		baseOK(t, err)
		baseSQL(t, pool, string(body))
	}
	baseSQL(t, pool, fmt.Sprintf(`INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,%d,%d,'c',%d,0)`, city, player, city))
}

func dueCity(t *testing.T, pool *pgxpool.Pool, p freshsource.Profile, city int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `INSERT INTO mil_city_origin VALUES(1,$1,1,$2,1,$3)`, city, p.Cohort[:], time.Now().UTC().Add(24*time.Hour).Truncate(time.Millisecond))
	baseOK(t, err)
	baseSQL(t, pool, fmt.Sprintf(`INSERT INTO city_troop VALUES(1,%d,1,5,1),(1,%d,2,0,0),(1,%d,3,0,0),(1,%d,4,0,0)`, city, city, city, city))
}

func TestPGDueKeysetAndApply(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	pool, b, p := completionPG(t, active, waiting, done)
	dueWorld(t, pool, 100, 1)
	dueWorld(t, pool, 101, 1)
	bad := active
	bad.queueID, bad.command, bad.qCity = 44, RecruitCommandID{7}, 101
	bad.accepted, bad.qstart, bad.rstart = active.accepted.Add(-time.Hour), active.qstart.Add(-time.Hour), active.rstart.Add(-time.Hour)
	bad.qfinish, bad.rfinish = active.qfinish.Add(-time.Hour), active.rfinish.Add(-time.Hour)
	dueSeed(t, pool, bad)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	page, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), RecruitDueCursor{}, 1)
	baseOK(t, err)
	if len(page) != 1 || page[0].QueueID != 44 || page[0].CityID != 101 {
		t.Fatalf("page1 = %+v", page)
	}
	baseOK(t, o.Rollback(ctx))
	before := completionState(t, pool)
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	if effects, err := participant.ApplyDueRecruits(ctx, a, page); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("bad apply = %+v, %v", effects, err)
	}
	baseOK(t, o.Rollback(ctx))
	if completionState(t, pool) != before {
		t.Fatal("bad candidate wrote")
	}
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	next, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), RecruitDueCursor{FinishAt: page[0].FinishAt, QueueID: 44}, 10)
	baseOK(t, err)
	if len(next) != 1 || next[0].QueueID != 40 {
		t.Fatalf("page2 = %+v", next)
	}
	effects, err := participant.ApplyDueRecruits(ctx, a, next)
	baseOK(t, err)
	if len(effects) != 1 || effects[0].DoneID != 40 || effects[0].PromotedID != 41 || effects[0].Count != 2 {
		t.Fatalf("effects = %+v", effects)
	}
	baseOK(t, o.Commit(ctx))
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	completionNoWrite(t, pool, o, ctx, func() {
		if again, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), RecruitDueCursor{FinishAt: page[0].FinishAt, QueueID: 44}, 10); err != nil || len(again) != 0 {
			t.Fatalf("restart page = %+v, %v", again, err)
		}
		if effects, err := participant.ApplyDueRecruits(ctx, a, next); err != nil || len(effects) != 0 {
			t.Fatalf("restart apply = %+v, %v", effects, err)
		}
	})
}

func TestPGApplyDueMixedCity(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 1)
	dueCity(t, pool, p, 101)
	evidence, err := catalog.evidence(string(active.version), 1)
	baseOK(t, err)
	payload, err := encodeRecruitPayload(evidence, RecruitRequest{CityID: 101, UnitCfgID: 1, Count: 2})
	baseOK(t, err)
	other := active
	other.queueID, other.command, other.qCity, other.payload = 43, RecruitCommandID{4}, 101, payload
	dueSeed(t, pool, other)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionState(t, pool)
	if effects, err := participant.ApplyDueRecruits(ctx, a, append(dueOf(active), dueOf(other)...)); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("mixed = %+v, %v", effects, err)
	}
	baseOK(t, o.Rollback(ctx))
	if completionState(t, pool) != before {
		t.Fatal("mixed batch wrote")
	}
}

// WORLD ownership, not the MIL marker, authorizes completion: a city now owned
// by another player must fail before any write, and an independent connection
// must still see the original stock, queue, and receipt.
func TestPGApplyDueWorldOwner(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 2)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionState(t, pool)
	if effects, err := participant.ApplyDueRecruits(ctx, a, dueOf(active)); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("owner mismatch = %+v, %v", effects, err)
	}
	baseOK(t, o.Rollback(ctx))
	var stock, status, receipt int
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count FROM city_troop WHERE unit_cfg_id=1`).Scan(&stock))
	baseOK(t, pool.QueryRow(context.Background(), `SELECT status FROM work_queue WHERE queue_id=40`).Scan(&status))
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count(*) FROM mil_recruit_receipt WHERE queue_id=40`).Scan(&receipt))
	if stock != 5 || status != 1 || receipt != 1 || completionState(t, pool) != before {
		t.Fatalf("owner mismatch stock=%d queue=%d receipt=%d", stock, status, receipt)
	}
}
