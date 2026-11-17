package march

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestReturnLockedScopeAndInvalid(t *testing.T) {
	c, origin := ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0}
	for i := 0; i < 4; i++ {
		for _, id := range []int64{0, -1, marchIDCeiling + 1} {
			bad := c
			ids := []*int64{&bad.PlayerID, &bad.CityID, &bad.MarchID, &bad.ArmyID}
			*ids[i] = id
			if validReturnScope(1, bad, origin) {
				t.Fatal("unsafe identity accepted", bad)
			}
		}
	}
	for _, bad := range []ReturnOrigin{{2, 1, 100, 0, 0}, {1, 2, 100, 0, 0}, {1, 1, 101, 0, 0}, {1, 1, 100, -1, 0}, {1, 1, 100, 0, 500}} {
		if validReturnScope(1, c, bad) {
			t.Fatal("foreign origin accepted", bad)
		}
	}
	c.PlayerID, c.CityID, origin.PlayerID, origin.CityID = marchIDCeiling, marchIDCeiling, marchIDCeiling, marchIDCeiling
	if !validReturnScope(1, c, origin) || validReturnScope(2, c, origin) {
		t.Fatal("boundary scope")
	}
	for _, p := range []*ReturnParticipant{nil, {}, {source: &freshMilitarySource{}}} {
		got, err := p.returnLocked(context.Background(), nil, c, origin)
		if !errors.Is(err, ErrReturnSource) || !reflect.DeepEqual(got, returnLockedSnapshot{}) {
			t.Fatal("invalid source returned snapshot", got, err)
		}
	}
}

func TestReturnLockedGraphRejects(t *testing.T) {
	at := time.Date(2026, 1, 2, 3, 4, 5, 123456789, time.UTC)
	city, deadline := int64(100), at.Add(time.Minute)
	valid := returnLockedSnapshot{
		armyID: 1, owner: 1, cityID: &city, status: 3, armyStatus: 2, purpose: 1,
		toX: 1, toY: 1, x: 1, y: 1, depart: at.Add(-time.Minute), arrive: at, returnAt: &deadline,
		heroes: []int64{marchIDCeiling + 1}, units: []int32{1}, counts: []int32{7},
	}
	c, origin := ReturnCandidate{1, 1, 100, 1, 1}, ReturnOrigin{1, 1, 100, 0, 0}
	if classifyReturnGraph(c, origin, valid) != returnReturning {
		t.Fatal("valid exact submillisecond graph rejected")
	}
	credited, annihilated := valid, valid
	credited.status, credited.armyStatus, credited.x, credited.y = 4, 1, 0, 0
	annihilated.status, annihilated.armyStatus, annihilated.returnAt = 4, 1, nil
	annihilated.units, annihilated.counts = nil, nil
	if classifyReturnGraph(c, origin, credited) != returnCredited || classifyReturnGraph(c, origin, annihilated) != returnAnnihilated {
		t.Fatal("valid terminal graph rejected")
	}
	for _, change := range []func(*returnLockedSnapshot){
		func(s *returnLockedSnapshot) { s.units, s.counts = []int32{1, 1}, []int32{1, 1} },
		func(s *returnLockedSnapshot) { s.units = []int32{0} },
		func(s *returnLockedSnapshot) { s.units = []int32{5} },
		func(s *returnLockedSnapshot) { s.counts = []int32{0} },
		func(s *returnLockedSnapshot) { s.counts = []int32{-1} },
		func(s *returnLockedSnapshot) { s.heroes = nil },
		func(s *returnLockedSnapshot) { s.heroes = []int64{1, 1} },
		func(s *returnLockedSnapshot) { s.heroes = []int64{0} },
		func(s *returnLockedSnapshot) { s.heroes = []int64{-1} },
		func(s *returnLockedSnapshot) { s.armyID++ },
		func(s *returnLockedSnapshot) { s.owner++ },
		func(s *returnLockedSnapshot) { s.cityID = nil },
		func(s *returnLockedSnapshot) { s.fromY++ },
		func(s *returnLockedSnapshot) { s.toX = -1 },
		func(s *returnLockedSnapshot) { s.toY = 500 },
		func(s *returnLockedSnapshot) { s.purpose = 0 },
		func(s *returnLockedSnapshot) { s.purpose = 4 },
		func(s *returnLockedSnapshot) { s.depart = s.arrive },
		func(s *returnLockedSnapshot) { s.returnAt = &s.arrive },
		func(s *returnLockedSnapshot) { s.returnAt = nil },
		func(s *returnLockedSnapshot) { s.armyStatus = 1 },
		func(s *returnLockedSnapshot) { s.x = 0 },
		func(s *returnLockedSnapshot) { s.status = 2 },
		func(s *returnLockedSnapshot) { s.status = 4 },
		func(s *returnLockedSnapshot) { s.counts = nil },
		func(s *returnLockedSnapshot) { s.depart = time.Time{} },
		func(s *returnLockedSnapshot) { s.arrive = time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC) },
	} {
		s := valid
		change(&s)
		if classifyReturnGraph(c, origin, s) != 0 {
			t.Fatal("malformed graph accepted", s)
		}
	}
}
