package api

import (
	"context"
	"errors"

	metav1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/meta/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/meta"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
)

func (s *Server) metaService() *meta.Service {
	svc := meta.New(s.PlayersPool(), s.now)
	prestige := rank.NewPrestigeService(s.PlayersPool(), s.now)
	svc.Prestige = func(ctx context.Context, serverID int32, playerID, amount int64) error {
		return prestige.Add(ctx, serverID, playerID, amount)
	}
	return svc
}

func achievementProto(v meta.View) *metav1.AchievementView {
	out := &metav1.AchievementView{AchievementId: v.ID, Code: v.Code, Name: v.Name, Description: v.Description,
		Category: int32(v.Category), Metric: v.Metric, Threshold: v.Threshold, Progress: v.Progress,
		Claimed: v.Claimed, CanClaim: v.CanClaim, RewardGold: v.Reward.Gold, RewardPrestige: v.Reward.Prestige}
	for _, item := range v.Reward.Items {
		out.RewardItems = append(out.RewardItems, &metav1.MetaItemView{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	return out
}

func (s *Server) handleListAchievements(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	rows, err := s.metaService().List(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	out := &metav1.ListAchievementsResponse{}
	for _, row := range rows {
		out.Achievements = append(out.Achievements, achievementProto(row))
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClaimAchievement(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req metav1.ClaimAchievementRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	view, err := s.metaService().Claim(ctx, pc.ServerID, pc.PlayerID, req.GetAchievementId())
	if err != nil {
		msg := err.Error()
		if errors.Is(err, meta.ErrNotReached) || errors.Is(err, meta.ErrAlreadyClaimed) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, msg), nil
		}
		return nil, err
	}
	out := &metav1.ClaimAchievementResponse{Achievement: achievementProto(*view), Gold: view.Reward.Gold,
		Prestige: view.Reward.Prestige}
	for _, item := range view.Reward.Items {
		out.Items = append(out.Items, &metav1.MetaItemView{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClaimWorldPhaseRewards(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	claim, err := s.metaService().ClaimPhaseRewards(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		msg := err.Error()
		if errors.Is(err, meta.ErrNoPhaseReward) || errors.Is(err, meta.ErrAlreadyClaimed) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, msg), nil
		}
		return nil, err
	}
	out := &metav1.ClaimWorldPhaseRewardsResponse{Gold: claim.Gold, Prestige: claim.Prestige}
	for _, phase := range claim.Phases {
		out.Phases = append(out.Phases, int32(phase))
	}
	for _, item := range claim.Items {
		out.Items = append(out.Items, &metav1.MetaItemView{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetWorldProgress(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	_, _, _ = s.metaService().AdvancePhase(ctx, pc.ServerID)
	progress, err := s.metaService().CurrentPhase(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	data, err := marshal(&metav1.GetWorldProgressResponse{Phase: int32(progress.Phase), Name: progress.Name,
		Next: progress.Next, OwnedCities: progress.OwnedCities, CampaignClears: progress.Cleared,
		Unlock: progress.Unlock, RewardGold: progress.RewardGold, RewardPrestige: progress.RewardPrestige,
		RewardItemCfgId: progress.RewardItemCfgID, RewardItemCount: progress.RewardItemCount,
		CanClaim: progress.CanClaim, Claimed: progress.Claimed})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
