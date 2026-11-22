package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/campaign"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
)

func (s *Server) campaignService() *campaign.Service {
	svc := campaign.New(s.PlayersPool(), s.now)
	prestige := rank.NewPrestigeService(s.PlayersPool(), s.now)
	svc.Prestige = func(ctx context.Context, serverID int32, playerID, amount int64) error {
		return prestige.Add(ctx, serverID, playerID, amount)
	}
	return svc
}

func campaignStageProto(v campaign.View) *militaryv1.CampaignStageView {
	total := int32(0)
	for _, st := range v.Defender {
		total += st.Count
	}
	out := &militaryv1.CampaignStageView{StageId: v.ID, Code: v.Code, Name: v.Name, Chapter: int32(v.Chapter),
		StageOrder: int32(v.Order), TroopCap: v.TroopCap, Unlocked: v.Unlocked, Cleared: v.Cleared,
		Stars: int32(v.Stars), DefenderTotal: total, DefenderHero: v.DefenderHeroName, WallLevel: v.WallLevel,
		RewardGold: v.Rewards.Gold, RewardPrestige: v.Rewards.Prestige}
	for _, item := range v.Rewards.Items {
		out.RewardItems = append(out.RewardItems, &militaryv1.CampaignItemView{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	return out
}

func (s *Server) handleListCampaignStages(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	stages, err := s.campaignService().List(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	out := &militaryv1.ListCampaignStagesResponse{}
	for _, st := range stages {
		out.Stages = append(out.Stages, campaignStageProto(st))
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleFightCampaignStage(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.FightCampaignStageRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	level, err := s.drillLevel(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	if level < 1 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "drill ground not built"), nil
	}
	svc := s.campaignService()
	views, err := svc.List(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	unlocked := false
	for _, v := range views {
		if v.ID == req.GetStageId() && v.Unlocked {
			unlocked = true
		}
	}
	if !unlocked {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrStageLocked.Error()), nil
	}
	stage, err := svc.Load(ctx, req.GetStageId())
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrStageNotFound.Error()), nil
	}
	var attacker []march.TroopStack
	var total int64
	for _, row := range req.GetAttacker() {
		if row.GetUnitCfgId() < 1 || row.GetUnitCfgId() > 18 || row.GetCount() <= 0 {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrTroops.Error()), nil
		}
		total += int64(row.GetCount())
		attacker = append(attacker, march.TroopStack{UnitCfgID: row.GetUnitCfgId(), Count: row.GetCount()})
	}
	if len(attacker) == 0 || total > int64(stage.TroopCap) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrTroops.Error()), nil
	}

	var heroLevel int
	var heroForce, heroIntel int32
	if heroID := s.equipmentService().MonarchID(ctx, pc.ServerID, pc.PlayerID); heroID > 0 && s.heroSvc != nil {
		if detail, err := s.heroSvc.GetHeroDetail(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID); err == nil {
			heroLevel = int(detail.Hero.Level)
			heroForce = detail.Hero.Force
			heroIntel = detail.Hero.Intel
		}
	}
	catalog := march.DefaultUnitCatalog()
	attackerArmy := combat.ArmyFromStacksWithHero(catalog, attacker, heroLevel, heroForce, heroIntel, 1)
	if tactics, err := combat.TacticsPG(s.PlayersPool())(ctx, pc.ServerID, req.GetCityId()); err == nil {
		attackerArmy.UnitTactics = tactics
	}
	defenderArmy := combat.ArmyFromStacksWithHero(catalog, stage.Defender, stage.DefenderLevel, stage.DefenderForce, stage.DefenderIntel, 1)
	if stage.WallTower > 0 {
		if group, ok := battle.WallDefense("tower", int(stage.WallTower), stage.WallLevel); ok {
			defenderArmy.Defenses = []battle.WallGroup{group}
		}
	}
	rep := battle.Simulate(battle.BattleInput{
		BattleID:   fmt.Sprintf("campaign-%d-%d-%d", req.GetStageId(), pc.PlayerID, time.Now().UnixNano()),
		AttackerID: fmt.Sprintf("player-%d", pc.PlayerID),
		DefenderID: fmt.Sprintf("campaign-%d", req.GetStageId()),
		Attacker:   attackerArmy,
		Defender:   defenderArmy,
	})
	stars := int16(0)
	if rep.Result == battle.ResultAttackerWin {
		stars = 1
		remaining := 0
		for _, n := range rep.FinalAttackerUnits {
			remaining += n
		}
		ratio := float64(remaining) / float64(total)
		if ratio >= 0.6 {
			stars = 3
		} else if ratio >= 0.3 {
			stars = 2
		}
	}
	attackerInitial := 0
	for _, st := range attacker {
		attackerInitial += int(st.Count)
	}
	attackerSurvived := 0
	for _, n := range rep.FinalAttackerUnits {
		attackerSurvived += n
	}
	defenderInitial := 0
	for _, st := range stage.Defender {
		defenderInitial += int(st.Count)
	}
	defenderSurvived := 0
	for _, n := range rep.FinalDefenderUnits {
		defenderSurvived += n
	}
	out := &militaryv1.FightCampaignStageResponse{Result: string(rep.Result), Rounds: int32(len(rep.Rounds)),
		AttackerInitial: int32(attackerInitial), AttackerSurvived: int32(attackerSurvived),
		DefenderInitial: int32(defenderInitial), DefenderSurvived: int32(defenderSurvived), Stars: int32(stars)}
	if stars > 0 {
		progress, err := svc.Complete(ctx, pc.ServerID, pc.PlayerID, req.GetStageId(), stars)
		if err != nil && !errors.Is(err, campaign.ErrStageNotFound) {
			return nil, err
		}
		if progress != nil {
			out.FirstClear = progress.FirstClear
			out.RewardGold = progress.Rewards.Gold
			out.RewardPrestige = progress.Rewards.Prestige
			for _, item := range progress.Rewards.Items {
				out.RewardItems = append(out.RewardItems, &militaryv1.CampaignItemView{ItemCfgId: item.ItemCfgID, Count: item.Count})
			}
		}
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListArenaOpponents(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	if _, errPkt := s.playerCtx(ctx, pkt); errPkt != nil {
		return errPkt, nil
	}
	opponents, err := s.campaignService().ListArena(ctx)
	if err != nil {
		return nil, err
	}
	out := &militaryv1.ListArenaOpponentsResponse{}
	for _, o := range opponents {
		total := int32(0)
		for _, st := range o.Defender {
			total += st.Count
		}
		out.Opponents = append(out.Opponents, &militaryv1.ArenaOpponentView{OpponentId: o.ID, Name: o.Name,
			TroopCap: o.TroopCap, DefenderTotal: total, DefenderHero: o.DefenderHeroName, WallLevel: o.WallLevel,
			RewardGold: o.RewardGold, RewardPrestige: o.RewardPrestige, RewardItemCfgId: o.RewardItemCfgID,
			RewardItemCount: o.RewardItemCount})
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleFightArenaOpponent(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.FightArenaOpponentRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	if level, err := s.drillLevel(ctx, pc.ServerID, req.GetCityId()); err != nil || level < 1 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "drill ground not built"), nil
	}
	svc := s.campaignService()
	opponent, err := svc.LoadArena(ctx, req.GetOpponentId())
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrStageNotFound.Error()), nil
	}
	var attacker []march.TroopStack
	var total int64
	for _, row := range req.GetAttacker() {
		if row.GetUnitCfgId() < 1 || row.GetUnitCfgId() > 18 || row.GetCount() <= 0 {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrTroops.Error()), nil
		}
		total += int64(row.GetCount())
		attacker = append(attacker, march.TroopStack{UnitCfgID: row.GetUnitCfgId(), Count: row.GetCount()})
	}
	if len(attacker) == 0 || total > int64(opponent.TroopCap) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, campaign.ErrTroops.Error()), nil
	}
	var heroLevel int
	var heroForce, heroIntel int32
	if heroID := s.equipmentService().MonarchID(ctx, pc.ServerID, pc.PlayerID); heroID > 0 && s.heroSvc != nil {
		if detail, err := s.heroSvc.GetHeroDetail(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID); err == nil {
			heroLevel = int(detail.Hero.Level)
			heroForce = detail.Hero.Force
			heroIntel = detail.Hero.Intel
		}
	}
	catalog := march.DefaultUnitCatalog()
	defenderArmy := combat.ArmyFromStacksWithHero(catalog, opponent.Defender, opponent.DefenderLevel,
		opponent.DefenderForce, opponent.DefenderIntel, 1)
	if opponent.WallTower > 0 {
		if group, ok := battle.WallDefense("tower", int(opponent.WallTower), opponent.WallLevel); ok {
			defenderArmy.Defenses = []battle.WallGroup{group}
		}
	}
	rep := battle.Simulate(battle.BattleInput{
		BattleID:   fmt.Sprintf("arena-%d-%d-%d", opponent.ID, pc.PlayerID, time.Now().UnixNano()),
		AttackerID: fmt.Sprintf("player-%d", pc.PlayerID),
		DefenderID: fmt.Sprintf("arena-%d", opponent.ID),
		Attacker:   combat.ArmyFromStacksWithHero(catalog, attacker, heroLevel, heroForce, heroIntel, 1),
		Defender:   defenderArmy,
	})
	attackerInitial := int(total)
	attackerSurvived := 0
	for _, n := range rep.FinalAttackerUnits {
		attackerSurvived += n
	}
	defenderInitial := 0
	for _, st := range opponent.Defender {
		defenderInitial += int(st.Count)
	}
	defenderSurvived := 0
	for _, n := range rep.FinalDefenderUnits {
		defenderSurvived += n
	}
	out := &militaryv1.FightArenaOpponentResponse{Result: string(rep.Result), Rounds: int32(len(rep.Rounds)),
		AttackerInitial: int32(attackerInitial), AttackerSurvived: int32(attackerSurvived),
		DefenderInitial: int32(defenderInitial), DefenderSurvived: int32(defenderSurvived)}
	if rep.Result == battle.ResultAttackerWin {
		reward, err := svc.CompleteArena(ctx, pc.ServerID, pc.PlayerID, opponent.ID)
		if err != nil {
			return nil, err
		}
		out.FirstWin = reward.FirstWin
		out.RewardGold = reward.Gold
		out.RewardPrestige = reward.Prestige
		out.RewardItemCfgId = reward.ItemCfgID
		out.RewardItemCount = reward.ItemCount
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
