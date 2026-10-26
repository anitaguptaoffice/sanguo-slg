package api

import (
	"reflect"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"google.golang.org/protobuf/proto"
)

func TestMarchSummaryReturnDeadline(t *testing.T) {
	depart := time.UnixMilli(1792957562123)
	arrive := depart.Add(72 * time.Second)
	deadline := arrive.Add(72 * time.Second)
	phases := []struct {
		name   string
		domain march.MarchPhase
		wire   militaryv1.MarchPhase
	}{
		{"pending", march.PhasePending, militaryv1.MarchPhase_MARCH_PHASE_PENDING},
		{"marching", march.PhaseMarching, militaryv1.MarchPhase_MARCH_PHASE_MARCHING},
		{"arrived", march.PhaseArrived, militaryv1.MarchPhase_MARCH_PHASE_ARRIVED},
		{"unspecified", "", militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED},
		{"unknown", "future", militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED},
		{"returning", march.PhaseReturning, militaryv1.MarchPhase_MARCH_PHASE_RETURNING},
	}
	times := []struct {
		name  string
		value time.Time
	}{
		{"zero", time.Time{}},
		{"deadline", deadline},
		{"epoch", time.UnixMilli(0)},
	}
	for _, phase := range phases {
		for _, ts := range times {
			t.Run(phase.name+"/"+ts.name, func(t *testing.T) {
				order := march.MarchOrder{
					ID: 101, ArmyID: 202, FromX: 60, FromY: 61, ToX: 62, ToY: 63,
					Purpose: 2, Phase: phase.domain, Speed: 4, LastReportID: 99,
					DepartAt: depart, ArriveAt: arrive, ReturnFinishAt: ts.value,
				}
				before := order
				stacks := []march.TroopStack{{UnitCfgID: 1, Count: 3}, {UnitCfgID: 2, Count: 5}}
				beforeStacks := append([]march.TroopStack(nil), stacks...)
				var wantReturn int64
				if phase.domain == march.PhaseReturning && !ts.value.IsZero() {
					wantReturn = ts.value.UnixMilli()
				}
				want := &militaryv1.MarchSummary{
					MarchId: 101, ArmyId: 202, OriginCityId: 303,
					FromX: 60, FromY: 61, ToX: 62, ToY: 63, Purpose: 2,
					Phase: phase.wire, DepartAtMs: depart.UnixMilli(), ArriveAtMs: arrive.UnixMilli(),
					ReturnFinishAtMs: wantReturn,
					Troops:           []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 3}, {UnitCfgId: 2, Count: 5}},
				}
				got := marchSummaryProto(303, &order, stacks)
				if !proto.Equal(got, want) {
					t.Fatalf("summary = %v; want %v", got, want)
				}
				// Exercise both native RPC envelopes using the actual protobuf codec.
				start := &militaryv1.StartMarchResponse{March: got}
				var decodedStart militaryv1.StartMarchResponse
				roundTripMarchResponse(t, start, &decodedStart)
				if !proto.Equal(decodedStart.GetMarch(), want) {
					t.Fatalf("StartMarch binary summary = %v; want %v", decodedStart.GetMarch(), want)
				}
				list := &militaryv1.ListMarchesResponse{Marches: []*militaryv1.MarchSummary{got}}
				var decodedList militaryv1.ListMarchesResponse
				roundTripMarchResponse(t, list, &decodedList)
				if len(decodedList.GetMarches()) != 1 || !proto.Equal(decodedList.GetMarches()[0], want) {
					t.Fatalf("ListMarches binary summary = %v; want %v", decodedList.GetMarches(), want)
				}
				if order != before || !reflect.DeepEqual(stacks, beforeStacks) {
					t.Fatal("serialization mutated domain input")
				}
			})
		}
	}
}

func TestMarchSummaryNilOrder(t *testing.T) {
	if got := marchSummaryProto(303, nil, nil); got != nil {
		t.Fatalf("nil order summary = %v", got)
	}
}

func roundTripMarchResponse(t *testing.T, source, target proto.Message) {
	t.Helper()
	data, err := proto.Marshal(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := proto.Unmarshal(data, target); err != nil {
		t.Fatal(err)
	}
}
