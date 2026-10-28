package march

import (
	"bytes"
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
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
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	scope := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: row.command}
	intent := RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	snap := `SELECT (SELECT count(*) FROM work_queue)||','||(SELECT count(*) FROM mil_recruit_origin)||','||
		(SELECT count(*) FROM mil_recruit_receipt)||','||(SELECT last_value||','||is_called FROM work_queue_id_seq)`
	var before, after string
	baseOK(t, a.Scan(ctx, b, snap, nil, &before))
	got, err := participant.History(ctx, a, scope, intent, 40)
	want := RecruitAcceptance{QueueID: 40, CityID: 100, UnitCfgID: 1, Count: 2, Cost: row.cost, DurationSeconds: 60,
		CatalogVersion: string(row.version), RuleDigest: row.digest, AcceptedAt: row.accepted, InitialStatus: 1,
		InitialStartAt: row.rstart, InitialFinishAt: row.rfinish}
	if err != nil || got != want {
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
		{scope, 0}, {scope, 9007199254740992}, {scope, 41},
	} {
		if _, err := participant.History(ctx, a, bad.scope, intent, bad.id); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("invalid", bad, err)
		}
	}
	baseOK(t, a.Scan(ctx, b, snap, nil, &after))
	if after != before {
		t.Fatal("history wrote", before, after)
	}
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
		{"receipt digest", func(h *historyRow) { h.digest = [32]byte{0xbb} }},
		{"receipt version", func(h *historyRow) { h.version = []byte(second.Version) }},
		{"unknown version", func(h *historyRow) {
			h.payload = bytes.Replace(h.payload, []byte(first.Version), []byte(third.Version), 1)
			h.version = []byte(third.Version)
		}},
		{"missing receipt", func(h *historyRow) { h.omitReceipt = true }},
		{"queue city", func(h *historyRow) { h.qCity = 101 }},
		{"canceled", func(h *historyRow) { h.status = 3 }},
		{"waiting estimate moved", func(h *historyRow) {
			h.initial, h.status = 0, 0
			h.rstart = h.accepted.Add(time.Minute)
			h.rfinish = h.rstart.Add(time.Minute)
			h.qstart, h.qfinish = h.rstart.Add(time.Second), h.rfinish
		}},
	}
	for i, tc := range cases {
		h := *row
		h.queueID, h.command = int64(60+i), RecruitCommandID{byte(20 + i)}
		tc.mutate(&h)
		h.seed(t, pool)
		bad := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: h.command}
		if _, err := participant.History(ctx, a, bad, intent, h.queueID); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(tc.name, err)
		}
	}
	other, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	oo, oa, octx := baseOwner(t, other)
	if _, err := participant.History(octx, oa, scope, intent, 40); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("wrong binding", err)
	}
	baseOK(t, oo.Rollback(octx))
	eo, ea, ectx := baseOwner(t, b)
	baseOK(t, eo.Rollback(ectx))
	if _, err := participant.History(ectx, ea, scope, intent, 40); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("ended access", err)
	}
	baseOK(t, o.Rollback(ctx))
	participant.source.retired.Store(true)
	o, a, ctx = baseOwner(t, b)
	if _, err := participant.History(ctx, a, scope, intent, 40); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("retired source", err)
	}
	baseOK(t, o.Rollback(ctx))
}

func TestPGRecruitHistoryWaitsForQueueLock(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	row, catalog, _, _ := historyDefaults(t)
	row.seed(t, pool)
	o1, a1, ctx1 := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx1, b, a1, p, catalog)
	baseOK(t, err)
	scope := RecruitScope{ServerID: 1, PlayerID: 1, CommandID: row.command}
	intent := RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	baseOK(t, participant.Pin(ctx1, a1))
	if _, err := participant.History(ctx1, a1, scope, intent, 40); err != nil {
		t.Fatal(err)
	}
	o2, a2, ctx2 := baseOwner(t, b)
	baseOK(t, participant.Pin(ctx2, a2))
	short, cancel := context.WithTimeout(ctx2, 250*time.Millisecond)
	start := time.Now()
	_, err = participant.History(short, a2, scope, intent, 40)
	cancel()
	if !errors.Is(err, ErrRecruitUnavailable) || time.Since(start) < 200*time.Millisecond {
		t.Fatal("queue lock not waited", err)
	}
	_ = o2.Rollback(ctx2)
	baseOK(t, o1.Rollback(ctx1))
	o3, a3, ctx3 := baseOwner(t, b)
	defer func() { _ = o3.Rollback(ctx3) }()
	baseOK(t, participant.Pin(ctx3, a3))
	if _, err := participant.History(ctx3, a3, scope, intent, 40); err != nil {
		t.Fatal("post-rollback", err)
	}
}
