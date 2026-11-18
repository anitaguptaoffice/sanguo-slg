package march

import (
	"errors"
	"os"
	"testing"
	"time"
)

func TestPGCurrentRecruitQueuePromotion(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	pool, binding, profile := completionPG(t, active, waiting, done)
	body, err := os.ReadFile("../../../spec/db/002_world.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body)+` INSERT INTO player_city(server_id,city_id,player_id,name,x,y)
 VALUES(1,100,1,'capital',0,0)`)
	read := func() CurrentRecruitQueue {
		t.Helper()
		o, a, ctx, p := completionParticipant(t, binding, profile, catalog)
		var owner int64
		baseOK(t, a.Scan(ctx, binding, `SELECT player_id FROM player_city WHERE server_id=1 AND city_id=100 FOR UPDATE`, nil, &owner))
		var result CurrentRecruitQueue
		completionNoWrite(t, pool, o, ctx, func() {
			result, err = p.ReadCurrentRecruitQueue(ctx, a, 1, owner, 100)
			baseOK(t, err)
		})
		return result
	}
	initial := read()
	if initial.HasMore || len(initial.Jobs) != 2 ||
		initial.Jobs[0].QueueID != active.queueID || initial.Jobs[0].Status != 1 ||
		initial.Jobs[1].QueueID != waiting.queueID || initial.Jobs[1].Status != 0 ||
		!initial.Jobs[1].FinishAt.Equal(waiting.qfinish) {
		t.Fatalf("due but unprocessed work must still appear, retained terminal work must not: %#v", initial)
	}
	o, a, ctx, participant := completionParticipant(t, binding, profile, catalog)
	got, err := completeUnderCityLock(ctx, a, binding, participant, completionCandidate(active))
	completionWant(t, got, err, RecruitCompleted)
	baseOK(t, o.Commit(ctx))

	after := read() // New bound read transaction.
	var liveFinish time.Time
	var ready int32
	o, a, ctx, _ = completionParticipant(t, binding, profile, catalog)
	baseOK(t, a.Scan(ctx, binding, `SELECT finish_at,(SELECT count FROM city_troop WHERE server_id=1 AND city_id=100 AND unit_cfg_id=1)
 FROM work_queue WHERE server_id=1 AND queue_id=41`, nil, &liveFinish, &ready))
	if len(after.Jobs) != 1 || after.Jobs[0].QueueID != waiting.queueID || after.Jobs[0].Status != 1 ||
		!after.Jobs[0].FinishAt.Equal(liveFinish) || after.Jobs[0].FinishAt.Equal(waiting.rfinish) ||
		ready != int32(5)+active.count {
		t.Fatalf("missing actual promotion or ordinary ready credit: %#v, %v, %d", after, liveFinish, ready)
	}
	baseOK(t, o.Rollback(ctx))
}

func TestPGCurrentRecruitQueueCompleteEvidence(t *testing.T) {
	catalog, active, waiting := preparePending(t)
	pool, b, scope := completionPG(t)
	o, a, ctx, participant := completionParticipant(t, b, scope, catalog)
	read := func(server int32, player int64) (CurrentRecruitQueue, error) {
		return participant.ReadCurrentRecruitQueue(ctx, a, server, player, 100)
	}
	baseline := completionState(t, pool)
	empty, err := read(1, 1)
	baseOK(t, err)
	if len(empty.Jobs) != 0 || empty.HasMore {
		t.Fatal("empty source produced a queue", empty)
	}
	for _, identity := range []struct {
		server int32
		player int64
	}{{2, 1}, {1, 2}} {
		x, err := read(identity.server, identity.player)
		if !errors.Is(err, ErrRecruitUnavailable) || len(x.Jobs) != 0 || x.HasMore {
			t.Fatal("unavailable scope exposed a queue", identity, err)
		}
	}
	prepareSeedRow(t, ctx, a, b, active)
	for i := 1; i <= 64; i++ {
		row := waiting
		row.queueID, row.command = int64(40+i), RecruitCommandID{byte(i + 1)}
		prepareSeedRow(t, ctx, a, b, row)
	}
	before := prepareRowsHash(t, ctx, a, b, scope)
	x, err := read(1, 1)
	baseOK(t, err)
	if len(x.Jobs) != 64 || !x.HasMore || x.Jobs[0].QueueID != 40 || x.Jobs[63].QueueID != 103 {
		t.Fatal("invalid prefix", x)
	}
	if before != prepareRowsHash(t, ctx, a, b, scope) {
		t.Fatal("view changed the pending set or its evidence")
	}
	execPrep(t, ctx, a, b, `DELETE FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=104`)
	x, err = read(1, 1)
	if !errors.Is(err, ErrRecruitUnavailable) || len(x.Jobs) != 0 || x.HasMore {
		t.Fatal("missing evidence beyond prefix was hidden", err)
	}
	baseOK(t, o.Rollback(ctx))
	if baseline != completionState(t, pool) {
		t.Fatal("view changed committed state or advanced the sequence")
	}
}
