package api

import (
	"context"
	"encoding/base64"
	"math"
	"reflect"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestMarchTroopParsingNormalizesBeforeHeroClaim(t *testing.T) {
	for _, tc := range []struct {
		name string
		rows []*apicommon.CityTroopStack
		code commonv1.ErrorCode
	}{
		{"unknown", []*apicommon.CityTroopStack{{UnitCfgId: 999, Count: 1}}, commonv1.ErrorCode_MILITARY_INVALID_UNIT},
		{"overflow", []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: math.MaxInt32}, {UnitCfgId: 1, Count: 1}}, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT},
		{"negative", []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: -1}}, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT},
		{"nil", []*apicommon.CityTroopStack{nil}, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := garrisonServer(t)
			ctx := context.Background()
			now := time.Unix(1700000000, 0)
			s.heroSvc = hero.NewService()
			s.SetClock(func() time.Time { return now })
			h := &hero.Hero{ServerID: 1, PlayerID: 55, TemplateCfgID: 1001, Level: 1, Status: hero.StatusIdle, CreatedAt: now}
			if err := s.heroSvc.Store.CreateHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			before := hero.MarchForceState{ServerID: 1, HeroID: h.HeroID, Current: hero.MarchForceMax(1), LastRegenAt: now}
			if err := s.heroSvc.Store.SaveMarchForceState(ctx, before); err != nil {
				t.Fatal(err)
			}
			resp, err := s.handleStartMarch(ctx, &commonv1.ClientPacket{SessionId: "owner", ServerId: 1, Payload: mustProto(&militaryv1.StartMarchRequest{CityId: 7, HeroId: h.HeroID, ToX: 5, ToY: 5, Purpose: 1, Troops: tc.rows})})
			if err != nil || resp.Code != int32(tc.code) {
				t.Fatalf("response %+v %v", resp, err)
			}
			force, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, h.HeroID)
			if err != nil || force == nil || *force != before {
				t.Fatalf("invalid input charged force %+v %v", force, err)
			}
			got, err := s.heroSvc.Store.GetHero(ctx, 1, h.HeroID)
			if err != nil || got.Status != hero.StatusIdle || s.nextArmyID != 0 || len(s.playerMarches[55]) != 0 {
				t.Fatalf("invalid input published hero/order %+v %v", got, err)
			}
		})
	}
	in := []*apicommon.CityTroopStack{{UnitCfgId: 3, Count: 2}, {UnitCfgId: 1, Count: 4}, {UnitCfgId: 3, Count: 5}}
	got, errPkt := parseMarchTroops("parse", in)
	if errPkt != nil || !reflect.DeepEqual(got, []march.TroopStack{{UnitCfgID: 3, Count: 7}, {UnitCfgID: 1, Count: 4}}) || in[0].Count != 2 {
		t.Fatalf("normalize %+v %+v", got, errPkt)
	}
	got[0].Count = 999
	if in[0].Count != 2 {
		t.Fatal("input alias")
	}
}

func TestMarchListUsesConsistentCurrentSurvivors(t *testing.T) {
	for _, tc := range []struct {
		name   string
		result march.MarchArrivalOutcome
		want   int32
		phase  militaryv1.MarchPhase
	}{
		{"returning", march.MarchArrivalOutcome{BattleRan: true, ReportID: 1, RemainingTroops: []march.TroopStack{{UnitCfgID: 1, Count: 166}}}, 166, militaryv1.MarchPhase_MARCH_PHASE_RETURNING},
		{"zero", march.MarchArrivalOutcome{BattleRan: true, ReportID: 1}, 0, militaryv1.MarchPhase_MARCH_PHASE_ARRIVED},
		{"no-battle", march.MarchArrivalOutcome{}, 200, militaryv1.MarchPhase_MARCH_PHASE_ARRIVED},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := garrisonServer(t)
			ctx := context.Background()
			now := time.Unix(1700000000, 0)
			hub := march.NewHub(func() time.Time { return now })
			s.military = hub
			hub.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 300}})
			hub.SetMarchArrivalHandler(func(context.Context, march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
				return tc.result, nil
			})
			original := []march.TroopStack{{UnitCfgID: 1, Count: 200}}
			order, err := hub.CreateMarch(march.StartMarchRequest{OriginCityID: 7, PlayerID: 55, ArmyID: 1, ToX: 10, Purpose: 1, Troops: original})
			if err != nil {
				t.Fatal(err)
			}
			s.recordPlayerMarch(55, 7, order.ID, 1, original)
			call := func() *militaryv1.ListMarchesResponse {
				t.Helper()
				resp, err := s.handleListMarches(ctx, &commonv1.ClientPacket{SessionId: "owner", ServerId: 1, Payload: mustProto(&militaryv1.ListMarchesRequest{CityId: 7})})
				out := new(militaryv1.ListMarchesResponse)
				if err != nil || resp.Code != 0 || unmarshal(resp.Data, out) != nil {
					t.Fatalf("list %+v %v", resp, err)
				}
				return out
			}
			initial := call()
			if len(initial.Marches) != 1 || initial.Marches[0].Troops[0].Count != 200 {
				t.Fatalf("outbound %+v", initial)
			}
			now = order.ArriveAt
			if hub.Tick() != 1 {
				t.Fatal("arrival not processed")
			}
			out := call()
			if len(out.Marches) != 1 || out.Total != 1 || out.Marches[0].Phase != tc.phase {
				t.Fatalf("phase %+v", out)
			}
			row := out.Marches[0]
			if tc.want == 0 {
				if len(row.Troops) != 0 {
					t.Fatalf("dead troops retained %+v", row)
				}
			} else if len(row.Troops) != 1 || row.Troops[0].Count != tc.want {
				t.Fatalf("stale troops %+v", row)
			}
			if s.playerMarches[55][0].troops[0].Count != 200 {
				t.Fatal("read mutated original ownership index")
			}
			if tc.want == 166 {
				if row.ReturnFinishAtMs != now.Add(order.ArriveAt.Sub(order.DepartAt)).UnixMilli() {
					t.Fatalf("return deadline %+v", row)
				}
				row.Troops[0].Count = 999
				if fresh := call(); fresh.Marches[0].Troops[0].Count != 166 {
					t.Fatal("response alias")
				}
				now = time.UnixMilli(row.ReturnFinishAtMs)
				if before := call(); before.Marches[0].Phase != militaryv1.MarchPhase_MARCH_PHASE_RETURNING || hub.SnapshotCity(7).Troops[1] != 100 {
					t.Fatal("deadline/read manufactured settlement")
				}
				if hub.Tick() != 1 {
					t.Fatal("return not processed")
				}
				home := call()
				if home.Total != 1 || home.Marches[0].Phase != militaryv1.MarchPhase_MARCH_PHASE_RETURNED || home.Marches[0].ReturnFinishAtMs != 0 || home.Marches[0].Troops[0].Count != 166 || hub.SnapshotCity(7).Troops[1] != 266 {
					t.Fatalf("home %+v", home)
				}
				wire, err := marshal(home)
				if err != nil {
					t.Fatal(err)
				}
				t.Logf("settled ListMarchesResponse Go wire fixture base64=%s", base64.StdEncoding.EncodeToString(wire))
				for i := 0; i < 3; i++ {
					now = now.Add(time.Hour)
					if hub.Tick() != 0 || call().Marches[0].Troops[0].Count != 166 || hub.SnapshotCity(7).Troops[1] != 266 {
						t.Fatal("repeat tick/read recredited survivors")
					}
				}
			}
		})
	}
}
