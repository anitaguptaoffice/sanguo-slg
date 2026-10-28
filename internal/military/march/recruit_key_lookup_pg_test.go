package march

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func keyLookupOrigin(t *testing.T, pool *pgxpool.Pool, queue, player int64, command RecruitCommandID) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `INSERT INTO mil_recruit_origin(server_id,queue_id,player_id,operation,command_id) VALUES(1,$1,$2,1,$3)`, queue, player, command[:])
	baseOK(t, err)
}

func keyLookupReceipt(t *testing.T, pool *pgxpool.Pool, queue int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `INSERT INTO mil_recruit_receipt(server_id,queue_id,intent_version,city_id,unit_cfg_id,count,food_paid,wood_paid,iron_paid,stone_paid,duration_sec,catalog_version,rule_digest,accepted_at,initial_start_at,initial_finish_at,initial_status)
 VALUES(1,$1,1,100,1,5,1,2,3,4,60,'v1',decode(repeat('ab',32),'hex'),'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','2026-01-01T00:01:00Z',0)`, queue)
	baseOK(t, err)
}

func keyLookupPair(t *testing.T, pool *pgxpool.Pool, queue, player int64, command RecruitCommandID) {
	t.Helper()
	keyLookupOrigin(t, pool, queue, player, command)
	keyLookupReceipt(t, pool, queue)
}

func keyLookupJob(t *testing.T, pool *pgxpool.Pool, queue int64, status int16) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at,status) VALUES(1,$1,1,100,3,'2026-01-01T00:00:00Z','2026-01-01T00:01:00Z',$2)`, queue, status)
	baseOK(t, err)
}

func TestPGRecruitKeyLookupFind(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	catalog, _, _ := recruitSourceCatalog(t)
	leading, trailing := RecruitCommandID{1}, RecruitCommandID{}
	trailing[15] = 1
	keyLookupPair(t, pool, 10, 1, leading)
	keyLookupPair(t, pool, 11, 1, trailing)
	o, a, ctx := baseOwner(t, b)
	defer func() { _ = o.Rollback(ctx) }()
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)

	snapshot := `SELECT (SELECT count(*) FROM mil_recruit_origin)||','||(SELECT count(*) FROM mil_recruit_receipt)||','||(SELECT count(*) FROM work_queue)||','||(SELECT xmin::text FROM mil_recruit_origin WHERE queue_id=10)||','||(SELECT xmin::text FROM mil_recruit_receipt WHERE queue_id=10)`
	var before, after string
	var last, lastAfter int64
	var called, calledAfter bool
	baseOK(t, a.Scan(ctx, b, snapshot, nil, &before))
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &last, &called))
	hit := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: leading}
	for _, tc := range []struct {
		scope RecruitScope
		queue int64
		found bool
	}{
		{hit, 10, true},
		{RecruitScope{1, 1, trailing}, 11, true},
		{RecruitScope{1, 2, leading}, 0, false},
		{RecruitScope{1, 1, RecruitCommandID{1, 1}}, 0, false},
	} {
		if q, found, err := participant.Find(ctx, a, tc.scope); err != nil || q != tc.queue || found != tc.found {
			t.Fatal(tc.scope, q, found, err)
		}
	}
	for _, scope := range []RecruitScope{{0, 1, leading}, {-1, 1, leading}, {2, 1, leading}, {1, 0, leading}, {1, -1, leading}, {1, 1, RecruitCommandID{}}} {
		if _, _, err := participant.Find(ctx, a, scope); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("invalid scope", scope, err)
		}
	}
	if ok, err := participant.ReverseAbsent(ctx, a, hit); ok || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("present origin reverse", ok, err)
	}
	for _, scope := range []RecruitScope{{1, 2, leading}, {1, 1, RecruitCommandID{1, 1}}} {
		if ok, err := participant.ReverseAbsent(ctx, a, scope); !ok || err != nil {
			t.Fatal("dual absence", scope, ok, err)
		}
	}
	baseOK(t, a.Scan(ctx, b, snapshot, nil, &after))
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &lastAfter, &calledAfter))
	ids := []int64{int64(p.Objects["mil_recruit_origin"].OID), int64(p.Objects["mil_recruit_receipt"].OID)}
	var shared, stronger int64
	baseOK(t, a.Scan(ctx, b, `SELECT count(*) FILTER (WHERE mode='AccessShareLock'),count(*) FILTER (WHERE mode<>'AccessShareLock') FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND relation=ANY($1::pg_catalog.oid[])`, []any{ids}, &shared, &stronger))
	if before != after || last != lastAfter || called != calledAfter || shared < 2 || stronger != 0 {
		t.Fatalf("side effects %q %q %d %v %d %d", before, after, last, called, shared, stronger)
	}
	copied := *participant
	if q, found, err := copied.Find(ctx, a, hit); err != nil || !found || q != 10 {
		t.Fatal("copy", q, found, err)
	}
	other, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	oo, oa, octx := baseOwner(t, other)
	if _, _, err := participant.Find(octx, oa, hit); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("wrong binding", err)
	}
	baseOK(t, oo.Rollback(octx))
	eo, ea, ectx := baseOwner(t, b)
	baseOK(t, eo.Rollback(ectx))
	if _, _, err := participant.Find(ectx, ea, hit); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("ended access", err)
	}
	participant.source.retired.Store(true)
	if _, _, err := participant.Find(ctx, a, hit); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("retired", err)
	}
}

func TestPGRecruitKeyLookupUnavailable(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	catalog, _, _ := recruitSourceCatalog(t)
	only, mismatch, control := RecruitCommandID{2}, RecruitCommandID{3}, RecruitCommandID{4}
	keyLookupOrigin(t, pool, 20, 1, only)
	keyLookupOrigin(t, pool, 21, 1, mismatch)
	keyLookupPair(t, pool, 22, 1, control)
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	if _, _, err := participant.Find(ctx, a, RecruitScope{1, 1, only}); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("origin only", err)
	}
	if _, err := participant.ReverseAbsent(ctx, a, RecruitScope{1, 1, only}); err == nil {
		t.Fatal("origin only reverse")
	}
	if _, _, err := participant.Find(ctx, a, RecruitScope{1, 1, mismatch}); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("queue mismatch", err)
	}
	if q, found, err := participant.Find(ctx, a, RecruitScope{1, 1, control}); err != nil || !found || q != 22 {
		t.Fatal("control", q, found, err)
	}
	for i, status := range []int16{0, 1, 2, 3} {
		command := RecruitCommandID{byte(10 + i)}
		keyLookupOrigin(t, pool, int64(23+i), 1, command)
		keyLookupJob(t, pool, int64(23+i), status)
		if _, _, err := participant.Find(ctx, a, RecruitScope{1, 1, command}); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("status", status, err)
		}
		if _, err := participant.ReverseAbsent(ctx, a, RecruitScope{1, 1, command}); err == nil {
			t.Fatal("status reverse", status)
		}
	}
	baseOK(t, o.Rollback(ctx))

	baseSQL(t, pool, "ALTER TABLE mil_recruit_origin DROP CONSTRAINT mil_recruit_origin_server_id_player_id_operation_command_id_key")
	dup := RecruitCommandID{20}
	keyLookupPair(t, pool, 27, 1, dup)
	keyLookupPair(t, pool, 28, 1, dup)
	baseSQL(t, pool, "ALTER TABLE mil_recruit_origin DROP CONSTRAINT mil_recruit_origin_operation_check")
	otherOperation := RecruitCommandID{22}
	_, err = pool.Exec(context.Background(), `INSERT INTO mil_recruit_origin(server_id,queue_id,player_id,operation,command_id) VALUES(1,31,1,2,$1)`, otherOperation[:])
	baseOK(t, err)
	baseSQL(t, pool, "ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey")
	malformed := RecruitCommandID{21}
	keyLookupOrigin(t, pool, 29, 1, malformed)
	// A receipt with no origin carries no scope key and is unrepresentable under
	// the reviewed FK; it is covered by the frozen both-side-deletion limitation.
	keyLookupReceipt(t, pool, 30)

	o, a, ctx = baseOwner(t, b)
	defer func() { _ = o.Rollback(ctx) }()
	if _, _, err := participant.Find(ctx, a, RecruitScope{1, 1, dup}); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("duplicate", err)
	}
	if _, err := participant.ReverseAbsent(ctx, a, RecruitScope{1, 1, dup}); err == nil {
		t.Fatal("duplicate reverse")
	}
	if q, found, err := participant.Find(ctx, a, RecruitScope{1, 1, otherOperation}); err != nil || found || q != 0 {
		t.Fatal("other operation", q, found, err)
	}
	if _, _, err := participant.Find(ctx, a, RecruitScope{1, 1, malformed}); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("malformed link", err)
	}
	if _, err := participant.ReverseAbsent(ctx, a, RecruitScope{1, 1, malformed}); err == nil {
		t.Fatal("malformed reverse")
	}
}
