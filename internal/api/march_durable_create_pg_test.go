package api

import (
	"context"
	"os"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGPreparedMarchHandlerCreatesAndRecovers(t *testing.T) {
	for _, mode := range []string{"success", "store rejection", "publication rejection"} {
		t.Run(mode, func(t *testing.T) {
			f := newPreparedMarchPG(t, nil)
			ctx, observer, s, restore := f.ctx, f.observer, f.s, f.restore
			request := func(session string, count, x int32) *commonv1.ServerPacket {
				t.Helper()
				resp, err := f.request(ctx, session, count, x)
				returnPGOK(t, err)
				return resp
			}
			stock, maxForce := f.stock, f.maxForce
			for _, reply := range []*commonv1.ServerPacket{request("owner", 12, 1), request("owner", 4, -1), request("unbound", 4, 1)} {
				if reply.GetCode() == 0 || len(reply.GetData()) != 0 {
					t.Fatal("unsafe request passed the prepared gate", reply)
				}
			}
			if r, orders, status, force := stock(); r != 11 || orders != 0 || status != hero.StatusIdle || force != maxForce {
				t.Fatal("preflight rejection charged or published", r, orders, status, force)
			}
			switch mode {
			case "store rejection":
				returnPGExec(t, ctx, observer, "ALTER TABLE army_troop ADD CONSTRAINT reject_deploy CHECK (unit_cfg_id<>1)")
			case "publication rejection":
				s.military = march.NewHub(nil) // Inject refusal only at the confirmed publication boundary.
			}
			reply := request("owner", 4, 1)
			r, orders, status, force := stock()
			if force != maxForce-hero.MarchForceMarchCost {
				t.Fatal("expected exactly one committed claim charge", force, reply)
			}
			if mode == "store rejection" {
				if reply.GetCode() != 10003 || r != 11 || orders != 0 || status != hero.StatusIdle {
					t.Fatal("a definite create failure leaked stock, order or claim", reply, r, orders, status)
				}
				return
			}
			if r != 7 || orders != 1 || status != hero.StatusMarch {
				t.Fatal("missing confirmed durable stock, march or hero", r, orders, status)
			}
			fresh := march.NewHub(nil)
			restored, err := restore.Restore(ctx, fresh)
			returnPGOK(t, err)
			if len(restored.Marches) != 1 || restored.Marches[0].MarchID != 1 || fresh.March(1).ArmyID != 1 {
				t.Fatal("restart lost the committed identity", restored)
			}
			if mode == "publication rejection" {
				if reply.GetCode() != 10003 || request("owner", 4, 1).GetCode() != 10003 {
					t.Fatal("publication failure reported success or permitted retry", reply)
				}
				if retryStock, retryOrders, _, retryForce := stock(); retryStock != r || retryOrders != orders || retryForce != force {
					t.Fatal("retry after publication error applied another effect")
				}
				return
			}
			var response militaryv1.StartMarchResponse
			returnPGOK(t, unmarshal(reply.GetData(), &response))
			snapshot, _ := s.military.SnapshotMarch(1)
			if reply.GetCode() != 0 || response.GetMarch().GetMarchId() != 1 || len(response.GetCityTroops()) != 1 ||
				response.GetCityTroops()[0].GetCount() != 7 ||
				snapshot == nil || !snapshot.ArriveAt.Equal(fresh.March(1).ArriveAt) || s.military.SnapshotCity(1).Troops[1] != 900 {
				t.Fatal("response or Hub differs from committed authority", reply, &response)
			}
			list := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: RouteListMarches, SessionId: "owner", ServerId: 1})
			var marches militaryv1.ListMarchesResponse
			returnPGOK(t, unmarshal(list.GetData(), &marches))
			if list.GetCode() != 0 || len(marches.GetMarches()) != 1 || marches.GetMarches()[0].GetMarchId() != 1 {
				t.Fatal("confirmed march is missing from the owner's index", list, &marches)
			}
		})
	}
}

type preparedMarchPG struct {
	ctx      context.Context
	observer *pgx.Conn
	profile  freshsource.Profile
	g        *recruitGeneration
	s        *Server
	restore  *march.MarchRestore
	maxForce int32
	stock    func() (int32, int32, int16, int32)
	request  func(context.Context, string, int32, int32) (*commonv1.ServerPacket, error)
}

func newPreparedMarchPG(t *testing.T, tracer pgx.QueryTracer, configure ...func(*pgxpool.Config)) *preparedMarchPG {
	t.Helper()
	pool, observer, binding, profile := returnPGFixture(t, tracer, configure...)
	ctx := returnPGContext(t)
	for _, file := range []string{"005_hero.sql", "007_domestic_production_checkpoint.sql", "m4_004_hotel_recruit.sql"} {
		ddl, err := os.ReadFile("../../spec/db/" + file)
		returnPGOK(t, err)
		returnPGExec(t, ctx, observer, string(ddl))
	}
	returnPGExec(t, ctx, observer, `DELETE FROM march_order; DELETE FROM army_troop; DELETE FROM field_army;
		SELECT setval('work_queue_id_seq',100,false);
		UPDATE work_queue SET status=2 WHERE queue_id=1;
		INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES(1,1,1,'2026-01-01');
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,1,1001,1)`)
	g, err := newRecruitGeneration(binding, recruitSourceProjection(profile, recruitPGNames), recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { _ = g.close() })
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	hub := domestic.NewHub(func() time.Time { return now })
	hub.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), hub, march.NewHub(nil))
	s.SetClock(func() time.Time { return now })
	maxForce := hero.MarchForceMax(1)
	returnPGOK(t, s.heroSvc.Store.SaveMarchForceState(ctx, hero.MarchForceState{ServerID: 1, HeroID: 11, Current: maxForce, LastRegenAt: now}))
	restore, err := march.NewMarchRestore(ctx, pool, profile)
	returnPGOK(t, err)
	_, err = restore.Restore(ctx, s.military)
	returnPGOK(t, err)
	s.marchRestoreReady, s.preparedRecruit = true, g
	s.BindSession("owner", 1, 1, 1)
	s.SeedCityTroopsForTest(1, 1, 900)
	handle, err := s.preparedMarchHandler(ctx)
	returnPGOK(t, err)
	request := func(call context.Context, session string, count, x int32) (*commonv1.ServerPacket, error) {
		pkt := &commonv1.ClientPacket{
			Route: RouteStartMarch, SessionId: session, ServerId: 1, TraceId: "prepared-start",
			Payload: mustProto(&militaryv1.StartMarchRequest{CityId: 1, ToX: x, ToY: 1, Purpose: 1, HeroId: 11,
				Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: count}}}),
		}
		return handle(call, pkt)
	}
	stock := func() (ready, orders int32, status int16, force int32) {
		t.Helper()
		returnPGOK(t, observer.QueryRow(ctx, `SELECT
			(SELECT count FROM city_troop WHERE unit_cfg_id=1),
			(SELECT count(*) FROM march_order),
			(SELECT status FROM player_hero WHERE hero_id=11),
			(SELECT current_force FROM hero_march_force WHERE hero_id=11)`).Scan(&ready, &orders, &status, &force))
		return
	}
	return &preparedMarchPG{ctx, observer, profile, g, s, restore, maxForce, stock, request}
}
