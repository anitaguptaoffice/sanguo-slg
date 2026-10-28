package march

import (
	"bytes"
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type historyRow struct {
	queueID, player, qCity                     int64
	command                                    RecruitCommandID
	status, initial                            int16
	qstart, qfinish, accepted, rstart, rfinish time.Time
	payload, version                           []byte
	digest                                     [32]byte
	count                                      int32
	cost                                       Resources
	duration                                   int64
	omitReceipt, omitQueue                     bool
}

func (h *historyRow) seed(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	exec := func(q string, args ...any) { _, err := pool.Exec(context.Background(), q, args...); baseOK(t, err) }
	exec(`INSERT INTO mil_recruit_origin VALUES(1,$1,$2,1,$3)`, h.queueID, h.player, h.command[:])
	if !h.omitReceipt {
		exec(`INSERT INTO mil_recruit_receipt VALUES(1,$1,1,100,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
			h.queueID, h.count, h.cost.Food, h.cost.Wood, h.cost.Iron, h.cost.Stone, h.duration,
			h.version, h.digest[:], h.accepted, h.rstart, h.rfinish, h.initial)
	}
	if !h.omitQueue {
		exec(`INSERT INTO work_queue VALUES(1,$1,$2,$3,3,$4,$5,$6,$7)`, h.queueID, h.player, h.qCity, string(h.payload), h.qstart, h.qfinish, h.status)
	}
}

func historyDefaults(t *testing.T) (*historyRow, *RecruitCatalog, RecruitManifest, RecruitManifest) {
	t.Helper()
	catalog, first, second := recruitSourceCatalog(t)
	evidence, err := catalog.evidence(first.Version, 1)
	baseOK(t, err)
	payload, err := encodeRecruitPayload(evidence, RecruitRequest{CityID: 100, UnitCfgID: 1, Count: 2})
	baseOK(t, err)
	at := time.Date(2026, 1, 1, 0, 0, 0, 123000000, time.UTC)
	return &historyRow{queueID: 40, player: 1, qCity: 100, command: RecruitCommandID{1}, status: 1, initial: 1,
		qstart: at, qfinish: at.Add(time.Minute), accepted: at, rstart: at, rfinish: at.Add(time.Minute),
		payload: payload, version: []byte(first.Version), digest: evidence.Digest(), count: 2,
		cost: Resources{Food: 80, Wood: 40}, duration: 60}, catalog, first, second
}

func TestPGRecruitHistory(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	row, catalog, first, second := historyDefaults(t)
	row.seed(t, pool)
	_, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	scope := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: row.command}
	intent := RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	third := first
	third.Rules[0].Cost.Food++
	third.Version, err = RecruitManifestVersion(third.Rules)
	baseOK(t, err)
	evidence, err := catalog.evidence(first.Version, 1)
	baseOK(t, err)
	countThree, err := encodeRecruitPayload(evidence, RecruitRequest{CityID: 100, UnitCfgID: 1, Count: 3})
	baseOK(t, err)
	cases := []struct {
		name   string
		mutate func(*historyRow)
	}{
		{"payload count", func(h *historyRow) { h.payload = countThree }},
		{"receipt count", func(h *historyRow) { h.count = 3 }},
		{"receipt digest", func(h *historyRow) { h.digest = [32]byte{0xbb} }},
		{"receipt version", func(h *historyRow) { h.version = []byte(second.Version) }},
		{"unknown version", func(h *historyRow) {
			h.payload = bytes.Replace(h.payload, []byte(first.Version), []byte(third.Version), 1)
			h.version = []byte(third.Version)
		}},
		{"missing receipt", func(h *historyRow) { h.omitReceipt = true }},
		{"queue city", func(h *historyRow) { h.qCity = 101 }},
		{"canceled", func(h *historyRow) { h.status = 3 }},
		{"sub-ms queue", func(h *historyRow) {
			h.initial, h.status = 0, 2
			h.rstart, h.rfinish = h.accepted.Add(time.Minute), h.accepted.Add(2*time.Minute)
			h.qstart = h.accepted.Add(3*time.Minute + 123456789*time.Nanosecond)
			h.qfinish = h.qstart.Add(time.Minute)
		}},
	}
	for i, tc := range cases {
		h := *row
		h.queueID, h.command = int64(60+i), RecruitCommandID{byte(20 + i)}
		tc.mutate(&h)
		h.seed(t, pool)
	}
	promoted := *row
	promoted.queueID, promoted.command = 41, RecruitCommandID{2}
	promoted.initial, promoted.status = 0, 2
	promoted.rstart, promoted.rfinish = row.accepted.Add(time.Minute), row.accepted.Add(2*time.Minute)
	promoted.qstart, promoted.qfinish = row.accepted.Add(3*time.Minute), row.accepted.Add(4*time.Minute)
	promoted.seed(t, pool)
	snap := `md5(concat_ws('|',(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM work_queue t),(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_origin t),(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t),(SELECT last_value||','||is_called FROM work_queue_id_seq)))`
	var before, after string
	baseOK(t, a.Scan(ctx, b, "SELECT "+snap, nil, &before))
	want := RecruitAcceptance{QueueID: 40, CityID: 100, UnitCfgID: 1, Count: 2, Cost: row.cost, DurationSeconds: 60,
		CatalogVersion: string(row.version), RuleDigest: row.digest, AcceptedAt: row.accepted, InitialStatus: 1, InitialStartAt: row.rstart, InitialFinishAt: row.rfinish}
	if got, err := participant.History(ctx, a, scope, intent, 40); err != nil || got != want ||
		got.AcceptedAt.Location() != time.UTC || got.AcceptedAt.Nanosecond() != 123000000 {
		t.Fatalf("history %#v %v", got, err)
	}
	for _, changed := range []RecruitIntent{
		{Version: 0, CityID: 100, UnitCfgID: 1, Count: 2}, {Version: 2, CityID: 100, UnitCfgID: 1, Count: 2},
		{Version: 32768, CityID: 100, UnitCfgID: 1, Count: 2}, {Version: 65537, CityID: 100, UnitCfgID: 1, Count: 2},
		{Version: uint32(math.MaxUint32), CityID: 100, UnitCfgID: 1, Count: 2}, {Version: 1, CityID: 101, UnitCfgID: 1, Count: 2},
		{Version: 1, CityID: 100, UnitCfgID: 2, Count: 2}, {Version: 1, CityID: 100, UnitCfgID: 1, Count: 3},
	} {
		if _, err := participant.History(ctx, a, scope, changed, 40); !errors.Is(err, ErrRecruitConflict) {
			t.Fatal("conflict", changed, err)
		}
	}
	for _, bad := range []struct {
		scope RecruitScope
		id    int64
	}{
		{RecruitScope{2, 1, row.command}, 40}, {RecruitScope{1, 0, row.command}, 40}, {RecruitScope{1, 2, row.command}, 40},
		{RecruitScope{1, 1, RecruitCommandID{}}, 40}, {RecruitScope{1, 1, RecruitCommandID{9}}, 40},
		{scope, 0}, {scope, 9007199254740992}, {scope, 42},
	} {
		if _, err := participant.History(ctx, a, bad.scope, intent, bad.id); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("invalid", bad, err)
		}
	}
	if got, err := participant.History(ctx, a, RecruitScope{1, 1, promoted.command}, intent, 41); err != nil ||
		got.InitialStatus != 0 || !got.InitialStartAt.Equal(promoted.rstart) || !got.InitialFinishAt.Equal(promoted.rfinish) {
		t.Fatal("promoted history", got, err)
	}
	for i := range cases {
		bad := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: RecruitCommandID{byte(20 + i)}}
		for _, count := range []int32{2, 3} {
			if _, err := participant.History(ctx, a, bad, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: count}, int64(60+i)); !errors.Is(err, ErrRecruitUnavailable) {
				t.Fatal(cases[i].name, count, err)
			}
		}
	}
	baseOK(t, a.Scan(ctx, b, "SELECT "+snap, nil, &after))
	if after != before {
		t.Fatal("history wrote", before, after)
	}
	var raw time.Time
	baseOK(t, a.Scan(ctx, b, "SELECT set_config('TimeZone','Asia/Tokyo',true),accepted_at FROM mil_recruit_receipt WHERE queue_id=40", nil, &before, &raw))
	if before != "Asia/Tokyo" || raw.UTC() != row.accepted {
		t.Fatal("non-UTC readback", before, raw)
	}
}

func TestPGRecruitHistoryLockOrder(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	row, catalog, _, _ := historyDefaults(t)
	row.seed(t, pool)
	_, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	scope := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: row.command}
	intent := RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	obs := `SELECT count(*) FILTER (WHERE relation=(SELECT oid FROM pg_class WHERE relnamespace=$1 AND relname='work_queue') AND granted), count(*) FILTER (WHERE relation=(SELECT oid FROM pg_class WHERE relnamespace=$1 AND relname='mil_recruit_receipt') AND granted),cardinality(pg_blocking_pids($2)),(SELECT xmax::text::bigint FROM work_queue WHERE queue_id=40)=$3 FROM pg_locks WHERE pid=$2 AND locktype='tuple'`
	check := func(table string, wantQueue, wantReceipt int, wantLocked bool) {
		ob, ab, ctxb := baseOwner(t, b)
		var one, pid int
		baseOK(t, ab.Scan(ctxb, b, "SELECT 1 FROM "+table+" WHERE queue_id=40 FOR UPDATE", nil, &one))
		o2, a2, ctx2 := baseOwner(t, b)
		baseOK(t, participant.Pin(ctx2, a2))
		var xid int64
		baseOK(t, a2.Scan(ctx2, b, "SELECT txid_current()", nil, &xid))
		baseOK(t, a2.Scan(ctx2, b, "SELECT pg_backend_pid()", nil, &pid))
		errc := make(chan error, 1)
		go func() { _, err := participant.History(ctx2, a2, scope, intent, 40); errc <- err }()
		var q, r, blocked int
		var locked bool
		for i := 0; i < 500; i++ {
			baseOK(t, pool.QueryRow(context.Background(), obs, p.SchemaOID, pid, xid).Scan(&q, &r, &blocked, &locked))
			if blocked > 0 && q == wantQueue && r == wantReceipt && locked == wantLocked {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
		observed := blocked > 0 && q == wantQueue && r == wantReceipt && locked == wantLocked
		baseOK(t, ob.Rollback(ctxb))
		herr := <-errc
		baseOK(t, o2.Rollback(ctx2))
		if !observed || herr != nil {
			t.Fatalf("%s waitQueue=%d waitReceipt=%d blocked=%d queueLocked=%v err=%v", table, q, r, blocked, locked, herr)
		}
	}
	check("work_queue", 1, 0, false)
	check("mil_recruit_receipt", 0, 1, true)
}
