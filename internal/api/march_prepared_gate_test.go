package api

import (
	"context"
	"reflect"
	"testing"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestPreparedMarchGate(t *testing.T) {
	for _, tc := range []struct {
		name           string
		origin, writer bool
		purpose, code  int32
		calls          int
	}{
		{"missing origin before gate", false, false, 1, 50005, 0},
		{"unavailable writer", true, false, 1, 10003, 0},
		{"unsupported purpose", true, true, 5, 10003, 0},
		{"oversized attack alias", true, true, 65537, 10003, 0},
		{"ready writer receives validated attack", true, true, 1, 0, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, ctx := garrisonServer(t), context.Background()
			now := time.Unix(1700000000, 0)
			h := originHero(t, s, now)
			s.domestic = domestic.NewHub(func() time.Time { return now })
			if err := s.domestic.RegisterCity(&domestic.CityState{ID: 7, PlayerID: 55, LastSettleAt: now}); err != nil {
				t.Fatal(err)
			}
			now = now.Add(time.Hour)
			if tc.origin {
				s.cacheCityCoord(7, 0, 1)
			}
			s.military.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 20},
				RecruitJobs: []*march.RecruitJob{{ID: 1, UnitCfgID: 1, Count: 20, Status: march.QueueActive, FinishAt: now}}})
			beforeDom, beforeMIL := s.citySnapshot(7), s.military.SnapshotCity(7)
			beforeForce, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, h.HeroID)
			if err != nil || beforeForce == nil {
				t.Fatalf("force fixture: %v %v", beforeForce, err)
			}
			var calls int
			var writer preparedMarchWriter
			if tc.writer {
				writer = func(_ context.Context, pc PlayerContext, req *militaryv1.StartMarchRequest, coord cityCoord, troops []march.TroopStack, trace string) (*commonv1.ServerPacket, error) {
					calls++
					if pc.ServerID != 1 || pc.PlayerID != 55 || req.GetHeroId() != h.HeroID || req.GetCityId() != 7 ||
						coord != (cityCoord{0, 1}) || !reflect.DeepEqual(troops, []march.TroopStack{{UnitCfgID: 1, Count: 5}}) {
						t.Fatalf("invalid prepared handoff: %+v %v %+v %v", pc, req, coord, troops)
					}
					return okResp(trace, nil), nil
				}
			}
			pkt := originPacket(7, h.HeroID)
			var req militaryv1.StartMarchRequest
			if err := unmarshal(pkt.Payload, &req); err != nil {
				t.Fatal(err)
			}
			req.Purpose = tc.purpose
			pkt.Payload = mustProto(&req)
			resp, err := s.startMarch(ctx, pkt, true, writer)
			if err != nil || resp.GetCode() != tc.code || resp.GetTraceId() != pkt.TraceId || calls != tc.calls {
				t.Fatalf("wrong gate result: %v %v calls=%d", resp, err, calls)
			}
			after, err := s.heroSvc.Store.GetHero(ctx, 1, h.HeroID)
			afterForce, forceErr := s.heroSvc.Store.GetMarchForceState(ctx, 1, h.HeroID)
			if err != nil || forceErr != nil || !reflect.DeepEqual(beforeForce, afterForce) ||
				!reflect.DeepEqual(h, after) || !reflect.DeepEqual(beforeDom, s.citySnapshot(7)) ||
				!reflect.DeepEqual(beforeMIL, s.military.SnapshotCity(7)) || s.nextArmyID != 0 || len(s.marchStarting) != 0 {
				t.Fatal("gate settled, claimed or published prior to the prepared writer")
			}
		})
	}
}
