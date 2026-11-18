package march

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestHubPublishesCommittedMarch(t *testing.T) {
	for _, active := range []bool{false, true} {
		name := "staged"
		if active {
			name = "active"
		}
		t.Run(name, func(t *testing.T) {
			in := marchStoreSample()
			in.ArriveAt = in.ArriveAt.Add(5917 * time.Nanosecond)
			at := in.ArriveAt.UTC().Truncate(time.Microsecond)
			ids := MarchIdentity{MarchID: 57, ArmyID: 142}
			h := NewHub(func() time.Time { return in.DepartAt })
			if got, err := h.PublishCommittedMarch(in, ids); !errors.Is(err, ErrMarchPublication) || got != nil {
				t.Fatal("unrestored Hub accepted publication", got, err)
			}
			baseOK(t, installRestore(h, nil, nil))
			if active {
				baseOK(t, h.ActivateRestore())
			}
			h.EnsureCity(&CityState{ID: in.OriginCityID, PlayerID: in.PlayerID, Troops: map[int32]int32{1: 99}})
			wantTroops := cloneStacks(in.Troops)
			order, err := h.PublishCommittedMarch(in, ids)
			baseOK(t, err)
			order.ArmyID, in.Troops[0].Count = 99, 1
			got, troops := h.SnapshotMarch(ids.MarchID)
			if got == nil || got.ID != ids.MarchID || got.ArmyID != ids.ArmyID || got.Phase != PhaseMarching ||
				!got.ArriveAt.Equal(at) || !reflect.DeepEqual(troops, wantTroops) || h.SnapshotCity(in.OriginCityID).Troops[1] != 99 {
				t.Fatal("lost identity, deadline, on-field troops or altered ready stock", got, troops)
			}
			if dup, err := h.PublishCommittedMarch(in, ids); !errors.Is(err, ErrMarchPublication) || dup != nil {
				t.Fatal("duplicate publication", dup, err)
			}
			if !active {
				if h.Scheduler().PollDue(at) != 0 || len(h.restoreEv) != 1 {
					t.Fatal("staged order fired before activation")
				}
				baseOK(t, h.ActivateRestore())
			}
			if h.Scheduler().PollDue(at.Add(-time.Nanosecond)) != 0 ||
				h.Scheduler().PollDue(at) != 1 || h.Scheduler().PollDue(at) != 0 {
				t.Fatal("frozen deadline, duplicate due event or non-deterministic clock")
			}
		})
	}
}

func TestHubRejectsInvalidCommittedMarch(t *testing.T) {
	h := NewHub(nil)
	baseOK(t, installRestore(h, nil, nil))
	for _, ids := range []MarchIdentity{{}, {0, 1}, {1, 0}, {1, marchIDCeiling + 1}} {
		_, err := h.PublishCommittedMarch(marchStoreSample(), ids)
		mustErr(t, err, ErrMarchPublication)
	}
	in := marchStoreSample()
	in.Troops[1].UnitCfgID = 998
	_, err := h.PublishCommittedMarch(in, MarchIdentity{1, 2})
	mustErr(t, err, ErrMarchPublication)
	if len(h.marches)+len(h.marchCtx)+len(h.restoreEv) != 0 || h.nextMarch != 0 {
		t.Fatal("invalid publication left a partial order")
	}
}
