package api

import (
	"context"
	"errors"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	RouteGetBattleReport   = "military.v1.GetBattleReport"
	RouteListBattleReports = "military.v1.ListBattleReports"
	defaultReportListLimit = 20
	maxReportListLimit     = 100
)

func (s *Server) handleGetBattleReport(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.reports == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "battle reports unavailable"), nil
	}
	var req militaryv1.GetBattleReportRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetReportId() <= 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid report id"), nil
	}
	rec, err := s.reports.Get(ctx, pc.ServerID, req.GetReportId())
	if err != nil {
		if errors.Is(err, report.ErrNotFound) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "report not found"), nil
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, err.Error()), nil
	}
	if !playerCanViewReport(pc.PlayerID, rec) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "forbidden"), nil
	}
	data, err := marshal(&militaryv1.GetBattleReportResponse{
		Report: battleReportViewProto(rec),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListBattleReports(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.reports == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "battle reports unavailable"), nil
	}
	var req militaryv1.ListBattleReportsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = defaultReportListLimit
	}
	if limit > maxReportListLimit {
		limit = maxReportListLimit
	}
	page, err := s.reports.ListForPlayer(ctx, report.ListParams{
		ServerID: pc.ServerID,
		PlayerID: pc.PlayerID,
		Limit:    limit,
		Offset:   int(req.GetOffset()),
	})
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, err.Error()), nil
	}
	summaries := make([]*militaryv1.BattleReportSummary, 0, len(page.Items))
	for _, rec := range page.Items {
		summaries = append(summaries, battleReportSummaryProto(rec))
	}
	data, err := marshal(&militaryv1.ListBattleReportsResponse{
		Reports: summaries,
		Total:   int32(page.Total),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func playerCanViewReport(playerID int64, rec report.Record) bool {
	if rec.AttackerPlayerID == playerID {
		return true
	}
	return rec.HasDefenderPlayer && rec.DefenderPlayerID == playerID
}

func battleReportSummaryProto(rec report.Record) *militaryv1.BattleReportSummary {
	sum := &militaryv1.BattleReportSummary{
		ReportId:         rec.ReportID,
		AttackerPlayerId: rec.AttackerPlayerID,
		LocationX:        int32(rec.LocationX),
		LocationY:        int32(rec.LocationY),
		Outcome:          int32(rec.Outcome),
		CreatedAtMs:      rec.CreatedAt.UnixMilli(),
	}
	if rec.HasDefenderPlayer {
		sum.DefenderPlayerId = rec.DefenderPlayerID
	}
	if rec.HasDefenderCity {
		sum.DefenderCityId = rec.DefenderCityID
	}
	return sum
}

func battleReportViewProto(rec report.Record) *militaryv1.BattleReportView {
	return &militaryv1.BattleReportView{
		Summary: battleReportSummaryProto(rec),
		Detail:  battleReportDetailProto(rec.Detail),
	}
}

func battleReportDetailProto(rep battle.BattleReport) *militaryv1.BattleReportDetail {
	d := &militaryv1.BattleReportDetail{
		Result:             string(rep.Result),
		AttackerCasualties: troopMapToProto(rep.AttackerCasualties),
		DefenderCasualties: troopMapToProto(rep.DefenderCasualties),
		FinalAttacker:      troopMapToProto(rep.FinalAttacker),
		FinalDefender:      troopMapToProto(rep.FinalDefender),
		TargetName:         rep.TargetName,
		AttackerHero:       heroSummaryProto(rep.AttackerHero),
		DefenderHero:       heroSummaryProto(rep.DefenderHero),
		HeroExpGained:      rep.Loot.HeroExp,
		Loot:               lootProto(rep.Loot),
		OccupyResult:       rep.OccupyResult,
		StartDistance:      int32(rep.StartDistance),
		FinalDefenses:      wallMapToProto(rep.FinalDefenses),
	}
	for _, rr := range rep.Rounds {
		round := &militaryv1.BattleRound{
			Round:           int32(rr.Round),
			AttackerTroops:  troopMapToProto(rr.AttackerTroops),
			DefenderTroops:  troopMapToProto(rr.DefenderTroops),
			AttackerToDefHp: int32(rr.AttackerToDefHP),
			DefenderToAttHp: int32(rr.DefenderToAttHP),
			Distance:        int32(rr.Distance),
			Defenses:        wallMapToProto(rr.Defenses),
		}
		for _, action := range rr.Actions {
			round.Actions = append(round.Actions, &militaryv1.BattleRoundAction{
				Side: action.Side, Troop: string(action.Troop), Kind: action.Kind,
				Target: string(action.Target), DamageHp: int32(action.DamageHP), Defense: action.Defense,
			})
		}
		d.Rounds = append(d.Rounds, round)
	}
	return d
}

func wallMapToProto(m map[string]int) map[string]int32 {
	if len(m) == 0 {
		return nil
	}
	out := make(map[string]int32, len(m))
	for k, v := range m {
		out[k] = int32(v)
	}
	return out
}

func heroSummaryProto(h battle.HeroSummary) *militaryv1.BattleHeroSummary {
	if h.Name == "" && h.Level == 0 {
		return nil
	}
	return &militaryv1.BattleHeroSummary{Name: h.Name, Level: h.Level, Force: h.Force, Intel: h.Intel}
}

func lootProto(l battle.Loot) *militaryv1.BattleLoot {
	if l.Food == 0 && l.Wood == 0 && l.Stone == 0 && l.Iron == 0 && l.Gold == 0 && len(l.Items) == 0 {
		return nil
	}
	out := &militaryv1.BattleLoot{Food: l.Food, Wood: l.Wood, Stone: l.Stone, Iron: l.Iron, Gold: l.Gold}
	for _, item := range l.Items {
		out.Items = append(out.Items, &militaryv1.BattleLootItem{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	return out
}

func troopMapToProto(m map[battle.TroopType]int) map[string]int32 {
	if len(m) == 0 {
		return nil
	}
	out := make(map[string]int32, len(m))
	for k, v := range m {
		if v > 0 {
			out[string(k)] = int32(v)
		}
	}
	return out
}
