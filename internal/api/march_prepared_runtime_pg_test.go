package api

import (
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGPreparedMarchRuntimeLifecycle(t *testing.T) {
	for _, mode := range []string{"battle and return", "arrival failure", "hero release failure"} {
		t.Run(mode, func(t *testing.T) {
			f := newPreparedMarchPG(t, nil)
			ctx, conn := f.ctx, f.observer
			returnPGExec(t, ctx, conn, "UPDATE city_troop SET count=2200 WHERE unit_cfg_id=1")
			binding := f.g.s.binding
			profile := recruitSourceProjection(f.profile, recruitSourceInventories()[3])
			catalog := recruitAttemptPGCatalog(t)
			owner, err := binding.Begin(ctx)
			returnPGOK(t, err)
			t.Cleanup(func() { _, _ = rollbackRecruitValidation(owner) })
			fresh, err := march.NewFreshCityParticipant(ctx, binding, owner.Access(), profile)
			returnPGOK(t, err)
			recruit, err := march.NewRecruitParticipant(ctx, binding, owner.Access(), profile, catalog)
			returnPGOK(t, err)
			returnPGOK(t, owner.Rollback(ctx))
			military, err := NewMilitaryDurable(binding, profile, recruit, fresh)
			returnPGOK(t, err)
			newServer := func() *Server {
				s := NewServer(f.s.log, f.s.PlayersPool(), f.s.world, f.s.domestic, march.NewHub(nil))
				s.SetClock(f.s.now)
				s.AttachMilitaryDurable(military)
				s.WireFirstCityPreparedCreation(&FirstCityPreparedCreationSource{Binding: binding, Profile: profile, Mil: fresh})
				returnPGOK(t, s.RestorePreparedMarches(ctx))
				s.BindSession("owner", 1, 1, 1)
				s.SeedCityTroopsForTest(1, 1, 900)
				return s
			}
			s := newServer()
			request := &commonv1.ClientPacket{Route: RouteStartMarch, SessionId: "owner", ServerId: 1,
				Payload: mustProto(&militaryv1.StartMarchRequest{CityId: 1, ToX: 5, ToY: 5, Purpose: 1, HeroId: 11,
					Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 2000}}})}
			assertUnwired := func() {
				t.Helper()
				if got := s.GatewayRouter().Dispatch(ctx, request); got.GetMsg() != "unknown route" ||
					s.preparedRecruit != nil || !s.military.Scheduler().NextDue().IsZero() {
					t.Fatal("prepared route or scheduler became visible after rejected startup", got)
				}
			}
			unrelatedBinding := new(recruittx.Binding)
			s.firstCityPrepared.Binding = unrelatedBinding
			if s.WirePreparedMarch(ctx, f.profile, catalog) == nil {
				t.Fatal("startup accepted independent binding")
			}
			assertUnwired()
			s.firstCityPrepared.Binding = binding
			bad := returnSourceProjection(f.profile, returnPGNames[1:])
			if s.WirePreparedMarch(ctx, bad, catalog) == nil {
				t.Fatal("startup accepted incomplete inventory")
			}
			assertUnwired()
			returnPGOK(t, s.WirePreparedMarch(ctx, f.profile, catalog))
			t.Cleanup(func() { s.preparedMarch.cancel(); _ = s.preparedMarch.source.close() })
			req := s.GatewayRouter().Dispatch(ctx, request)
			var response militaryv1.StartMarchResponse
			returnPGOK(t, unmarshal(req.GetData(), &response))
			order := s.military.March(1)
			if req.GetCode() != 0 || response.GetMarch().GetMarchId() != 1 || order == nil ||
				response.GetCityTroops()[0].GetCount() != 200 || s.military.SnapshotCity(1).Troops[1] != 900 {
				t.Fatal("production router did not confirm a durable departure", req, order)
			}
			if mode == "arrival failure" {
				returnPGExec(t, ctx, conn, "ALTER TABLE battle_report ADD CONSTRAINT reject_runtime_battle CHECK (location_x<>5)")
			}
			if s.military.Scheduler().PollDue(order.ArriveAt) != 1 {
				t.Fatal("arrival was not dispatched")
			}
			if mode == "arrival failure" {
				if s.military.MarchArrivalError(1) == nil || s.preparedMarch.ctx.Err() == nil ||
					s.military.March(1).Phase != march.PhaseMarching {
					t.Fatal("unconfirmed battle kept the generation open")
				}
				assertPreparedMarchUnavailable(t, s.GatewayRouter().Dispatch(ctx, request))
				if ready, orders, status, _ := f.stock(); ready != 200 || orders != 1 || status != hero.StatusMarch {
					t.Fatal("unconfirmed battle changed the committed departure", ready, orders, status)
				}
				return
			}
			order, survivors := s.military.SnapshotMarch(1)
			if order.Phase != march.PhaseReturning || order.LastReportID != 1 || len(survivors) != 1 || survivors[0].Count <= 0 {
				t.Fatal("battle did not produce a report and surviving return", order, survivors, s.military.MarchArrivalError(1))
			}
			reportRequest := &commonv1.ClientPacket{Route: RouteGetBattleReport, SessionId: "owner", ServerId: 1,
				Payload: mustProto(&militaryv1.GetBattleReportRequest{ReportId: order.LastReportID})}
			if got := s.GatewayRouter().Dispatch(ctx, reportRequest); got.GetCode() != 0 || len(got.GetData()) == 0 {
				t.Fatal("committed battle report is missing from the real route", got)
			}
			if s.military.Scheduler().PollDue(order.ReturnFinishAt) != 1 || s.military.March(1).Phase != march.PhaseReturning {
				t.Fatal("injected scheduler clock bypassed the database's return deadline")
			}
			s.preparedMarch.cancel()
			returnPGOK(t, s.preparedMarch.source.close())
			// This fixture owns the database. Advance all three frozen deadlines
			// equally before restoring, keeping the realized travel time.
			returnPGExec(t, ctx, conn, `UPDATE march_order SET depart_at=depart_at-(return_finish_at-'2026-01-01'::timestamptz),
				arrive_at=arrive_at-(return_finish_at-'2026-01-01'::timestamptz),return_finish_at='2026-01-01'
				WHERE march_id=1 AND status=3;
				INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,12,1,1002,3);
				UPDATE field_army SET hero_ids=array_append(hero_ids,12::bigint) WHERE army_id=1`)
			restarted := newServer()
			returnPGOK(t, restarted.WirePreparedMarch(ctx, f.profile, catalog))
			t.Cleanup(func() { restarted.preparedMarch.cancel(); _ = restarted.preparedMarch.source.close() })
			if mode == "hero release failure" {
				returnPGExec(t, ctx, conn, "ALTER TABLE player_hero ADD CONSTRAINT reject_runtime_release CHECK (status<>1) NOT VALID")
			}
			due := restarted.military.March(1).ReturnFinishAt
			if restarted.military.Scheduler().PollDue(due.Add(-time.Microsecond)) != 0 ||
				restarted.military.Scheduler().PollDue(due) != 1 || restarted.military.Scheduler().PollDue(due) != 0 ||
				restarted.military.March(1).Phase != march.PhaseReturned {
				t.Fatal("restored worker did not publish exactly one return", restarted.military.MarchReturnError(1))
			}
			if mode == "hero release failure" {
				_, retained := restarted.lookupMarchHero(1)
				if ready, orders, status, _ := f.stock(); ready != 200+survivors[0].Count || orders != 1 ||
					status != hero.StatusMarch || !retained || restarted.preparedMarch.ctx.Err() == nil {
					t.Fatal("failed release masked return confirmation or lost its recovery binding", ready, orders, status)
				}
				assertPreparedMarchUnavailable(t, restarted.GatewayRouter().Dispatch(ctx, request))
				returnPGExec(t, ctx, conn, "ALTER TABLE player_hero DROP CONSTRAINT reject_runtime_release")
			}
			if recovered := newServer(); recovered.military.March(1) != nil {
				t.Fatal("confirmed terminal march replayed on startup")
			}
			var status, released, reports, retained int32
			returnPGOK(t, conn.QueryRow(ctx, `SELECT (SELECT status FROM march_order WHERE march_id=1),
				(SELECT count(*) FROM player_hero WHERE hero_id IN (11,12) AND status=1),
				(SELECT count(*) FROM battle_report), (SELECT count FROM army_troop WHERE army_id=1 AND unit_cfg_id=1)`).
				Scan(&status, &released, &reports, &retained))
			if ready, orders, _, force := f.stock(); ready != 200+survivors[0].Count || orders != 1 ||
				status != 4 || released != 2 || reports != 1 || retained != survivors[0].Count ||
				force != f.maxForce-hero.MarchForceMarchCost || restarted.military.SnapshotCity(1).Troops[1] != 900 {
				t.Fatal("live stock, retained survivor evidence, report or HERO state disagree", ready, orders, status, released, reports, retained, force)
			}
		})
	}
}
