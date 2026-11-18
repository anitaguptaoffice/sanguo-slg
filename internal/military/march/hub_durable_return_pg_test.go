package march

import (
	"errors"
	"maps"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestPGDurableHubReturnCommitAndRestore(t *testing.T) {
	f := newDeploymentPG(t)
	baseSQL(t, f.pool, "INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,1,11,3),(1,12,1,12,3)")
	o, a, ctx := baseOwner(t, f.binding)
	baseOK(t, f.lock(ctx, a))
	in := marchStoreSample()
	in.PlayerID, in.OwnerPlayerID, in.FromX, in.FromY = 1, 1, 0, 0
	// The fixture owns these frozen times. PG sees the order as overdue;
	// the Hub clock advances independently via explicit PollDue calls.
	in.DepartAt = time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	in.ArriveAt = in.DepartAt.Add(time.Hour)
	in.Troops = []TroopStack{{1, 3}, {2, 1}}
	deployed, err := f.recruit.DebitMarchTroops(ctx, a, 1, 1, 100, in.Troops)
	baseOK(t, err)
	ids, err := f.store.Create(ctx, a, in)
	baseOK(t, err)
	baseOK(t, o.Commit(ctx))
	if deployed != ([4]int32{2, 8, 0, 7}) {
		t.Fatal("incorrect fixture deployment", deployed)
	}

	due := in.ArriveAt.Add(time.Hour)
	transition, err := NewMarchTransition(report.NewService(report.NewPGStore(f.pool)), f.store.profile)
	baseOK(t, err)
	tx, err := f.pool.Begin(ctx)
	baseOK(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = transition.Commit(ctx, tx, ArrivalCommit{ServerID: 1, MarchID: ids.MarchID, ArmyID: ids.ArmyID,
		ToX: in.ToX, ToY: in.ToY, Survivors: in.Troops, ReturnAt: due})
	baseOK(t, err)
	baseOK(t, tx.Commit(ctx))

	restore, err := NewMarchRestore(ctx, f.pool, f.store.profile)
	baseOK(t, err)
	makeHub := func() *Hub {
		h := NewHub(func() time.Time { return due })
		got, err := restore.Restore(ctx, h)
		baseOK(t, err)
		if len(got.Marches) != 1 || got.Marches[0].MarchID != ids.MarchID {
			t.Fatal("missing live march in restored Hub", got)
		}
		h.EnsureCity(&CityState{ID: 100, PlayerID: 1, Troops: map[int32]int32{1: 87}})
		return h
	}
	profile := f.store.profile
	profile.Objects = maps.Clone(profile.Objects)
	for _, name := range returnNames {
		var v freshsource.ObjectIdentity
		baseOK(t, f.pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2",
			profile.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		profile.Objects[name] = v
	}
	ro, ra, run := baseOwner(t, f.binding)
	catalog, _, _ := preparePending(t)
	returner, err := NewReturnParticipant(run, f.binding, ra, profile, catalog)
	baseOK(t, err)
	baseOK(t, ro.Rollback(run))
	stale := makeHub() // Keep the same candidate past another Hub's confirmed commit.
	rolled := errors.New("fixture outer rollback")
	runReturn := func(h *Hub, abort bool, want ReturnDisposition) int {
		t.Helper()
		calls, notifications := 0, 0
		h.SetMarchFinishedHandler(func(int64) { notifications++ })
		baseOK(t, h.SetDurableMarchReturnHandler(func(ev DurableMarchReturnEvent) (ReturnObservation, error) {
			calls++
			return runHubReturnFixture(t, f, returner, ev, abort, want, rolled)
		}))
		baseOK(t, h.ActivateRestore())
		if h.Scheduler().PollDue(due.Add(-time.Nanosecond)) != 0 || h.Scheduler().PollDue(due) != 1 ||
			h.Scheduler().PollDue(due) != 0 || calls != 1 || h.SnapshotCity(100).Troops[1] != 87 {
			t.Fatal("incorrect scheduling or duplicate volatile credit")
		}
		return notifications
	}

	before := returnAtomicState(t, f.pool, false)
	failed := makeHub()
	if got := runReturn(failed, true, ReturnApplied); got != 0 || failed.March(ids.MarchID).Phase != PhaseReturning ||
		!errors.Is(failed.MarchReturnError(ids.MarchID), rolled) || returnAtomicState(t, f.pool, false) != before {
		t.Fatal("rollback was surfaced as completion or changed durable state")
	}
	confirmed := makeHub()
	if got := runReturn(confirmed, false, ReturnApplied); got != 1 || confirmed.March(ids.MarchID).Phase != PhaseReturned {
		t.Fatal("confirmed return did not publish")
	}
	after := returnAtomicState(t, f.pool, false)
	if got := runReturn(stale, false, ReturnCreditedTerminal); got != 1 || stale.March(ids.MarchID).Phase != PhaseReturned ||
		returnAtomicState(t, f.pool, false) != after {
		t.Fatal("retained terminal observation re-credited")
	}
	fresh := NewHub(nil)
	state, err := restore.Restore(ctx, fresh)
	baseOK(t, err)
	var ready []int32
	baseOK(t, f.pool.QueryRow(ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&ready))
	if len(state.Marches) != 0 || fresh.March(ids.MarchID) != nil || len(fresh.restoreEv) != 0 ||
		!reflect.DeepEqual(ready, []int32{5, 9, 0, 7}) || marchStoreRows(t, f.pool) != "1,1,2,0" {
		t.Fatal("restart repeated a terminal order or lost stock", state, ready)
	}
}

func runHubReturnFixture(t *testing.T, f deploymentPG, p *ReturnParticipant, ev DurableMarchReturnEvent, abort bool, want ReturnDisposition, rolled error) (ReturnObservation, error) {
	t.Helper()
	o, a, ctx := baseOwner(t, f.binding)
	execPrep(t, ctx, a, f.binding, "LOCK TABLE account,player IN ROW SHARE MODE; LOCK TABLE player_wallet IN ROW EXCLUSIVE MODE")
	baseOK(t, f.city.Pin(ctx, a))
	baseOK(t, p.Pin(ctx, a))
	var id int64
	for _, q := range []string{
		"SELECT account_id FROM account WHERE account_id=1 AND status=1 FOR SHARE",
		"SELECT player_id FROM player WHERE server_id=1 AND player_id=1 AND account_id=1 FOR SHARE",
		"SELECT player_id FROM player_wallet WHERE server_id=1 AND player_id=1 FOR UPDATE",
	} {
		baseOK(t, a.Scan(ctx, f.binding, q, nil, &id))
	}
	origin, err := f.city.LockReturnOrigin(ctx, a, ev.PlayerID, ev.CityID)
	baseOK(t, err)
	cand := ReturnCandidate{1, ev.PlayerID, ev.CityID, ev.MarchID, ev.ArmyID}
	before := returnAtomicState(t, f.pool, false)
	got, err := p.Complete(ctx, a, cand, ReturnOrigin{origin.ServerID, origin.PlayerID, origin.CityID, origin.X, origin.Y})
	baseOK(t, err)
	if got.Disposition != want || got.Candidate != cand || !got.ReturnAt.Equal(ev.ReturnAt) || returnAtomicState(t, f.pool, false) != before {
		t.Fatal("unconfirmed return work escaped or used a different order", got)
	}
	if abort {
		baseOK(t, o.Rollback(ctx))
		return ReturnObservation{}, rolled
	}
	return got, o.Commit(ctx)
}
