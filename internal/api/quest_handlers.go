package api

import (
	"context"
	"errors"

	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/obs"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

const (
	RouteListPlayerQuests    = "quest.v1.ListPlayerQuests"
	RouteAcceptQuest         = "quest.v1.AcceptQuest"
	RouteReportQuestProgress = "quest.v1.ReportQuestProgress"
	RouteClaimQuestReward    = "quest.v1.ClaimQuestReward"
	RouteGetQuestChainStatus = "quest.v1.GetQuestChainStatus"
)

func (s *Server) handleListPlayerQuests(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.questSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "quest not wired"), nil
	}
	var req questv1.ListPlayerQuestsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	actor := quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if _, err := s.recoverWallAndLevel(ctx, actor); err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	filter := quest.ListQuestsFilter{IncludeCompleted: req.GetIncludeCompleted()}
	if req.GetChainId() != 0 {
		filter.ChainIDs = []int32{req.GetChainId()}
		if req.GetChainId() == quest.DailyChainID {
			filter.QuestType = quest.QuestTypeDaily
		}
	} else {
		filter.ChainIDs = s.questChainIDs
	}
	views, chainViews, err := s.questSvc.ListPlayerQuests(ctx, actor, filter)
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	// Service reads can themselves recover a concurrently committed receipt.
	// Persist its completed-proof floor before returning that recovered view.
	if _, err := s.reconcileTutorialLevel(ctx, actor); err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	quests := make([]*questv1.PlayerQuestProgress, 0, len(views))
	for _, v := range views {
		quests = append(quests, questProgressToProto(v))
	}
	pbChains := make([]*questv1.QuestChainStatus, 0, len(chainViews))
	for _, st := range chainViews {
		pbChains = append(pbChains, questChainToProto(st))
	}
	data, err := marshal(&questv1.ListPlayerQuestsResponse{Quests: quests, Chains: pbChains})
	if err != nil {
		return nil, err
	}
	resp := okResp(pkt.GetTraceId(), data)
	resp.Msg = s.starterScrollNotice(ctx, pc)
	return resp, nil
}

func (s *Server) handleAcceptQuest(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req questv1.AcceptQuestRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	actor := quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if req.GetQuestCfgId() == 1006 {
		if err := s.requireWallActor(ctx, actor); err != nil {
			return questErr(pkt.GetTraceId(), err), nil
		}
	}
	q, chain, err := s.questSvc.AcceptQuest(ctx, actor, req.GetQuestCfgId())
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&questv1.AcceptQuestResponse{
		Quest: questProgressToProto(q),
		Chain: questChainToProto(chain),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleReportQuestProgress(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	_, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req questv1.ReportQuestProgressRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	// There is no approved client self-report allowlist. Trusted gameplay hooks
	// continue to call the quest service internally; this RPC cannot mint counts.
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "quest progress is server verified"), nil
}

func (s *Server) handleClaimQuestReward(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req questv1.ClaimQuestRewardRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	actor := quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	// Current actor validation is not fact/level reconciliation. Preserve the
	// unchanged phase-1 receipt-first path; only the new wall path adds this guard.
	if req.GetQuestCfgId() == 1006 {
		if err := s.requireWallActor(ctx, actor); err != nil {
			return questErr(pkt.GetTraceId(), err), nil
		}
	}
	// Never reconcile before the service has checked the exact paid receipt.
	q, chain, granted, claimErr := s.questSvc.ClaimQuestReward(ctx, actor, req.GetQuestCfgId())
	if claimErr != nil && !errors.Is(claimErr, quest.ErrAlreadyCompleted) {
		return questErr(pkt.GetTraceId(), claimErr), nil
	}
	// The reward is committed even if the subsequent level repair fails.
	s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
	level, err := s.reconcileTutorialLevel(ctx, actor)
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	if claimErr != nil {
		return questErr(pkt.GetTraceId(), claimErr), nil
	}
	data, err := marshal(&questv1.ClaimQuestRewardResponse{
		Quest:          questProgressToProto(q),
		Chain:          questChainToProto(chain),
		GrantedRewards: rewardBundleToProto(granted),
		PlayerLevel:    level,
	})
	if err != nil {
		return nil, err
	}
	obs.EmitGameplayEvent(s.log, pkt.GetTraceId(), obs.EventQuestClaimReward, obs.PlayerRef{
		ServerID: pc.ServerID,
		PlayerID: pc.PlayerID,
	})
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetQuestChainStatus(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req questv1.GetQuestChainStatusRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	actor := quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if _, err := s.recoverWallAndLevel(ctx, actor); err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	st, views, err := s.questSvc.GetQuestChainStatus(ctx, actor, req.GetChainId())
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	if _, err := s.reconcileTutorialLevel(ctx, actor); err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	pbViews := make([]*questv1.PlayerQuestProgress, 0, len(views))
	for _, v := range views {
		pbViews = append(pbViews, questProgressToProto(v))
	}
	data, err := marshal(&questv1.GetQuestChainStatusResponse{
		Chain:       questChainToProto(st),
		ChainQuests: pbViews,
	})
	if err != nil {
		return nil, err
	}
	resp := okResp(pkt.GetTraceId(), data)
	resp.Msg = s.starterScrollNotice(ctx, pc)
	return resp, nil
}

func questErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, quest.ErrQuestNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "quest not found")
	case errors.Is(err, quest.ErrPrerequisiteNotMet):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "prerequisite not met")
	case errors.Is(err, quest.ErrAlreadyAccepted):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, quest.ErrAlreadyAccepted.Error())
	case errors.Is(err, quest.ErrAlreadyCompleted):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, quest.ErrAlreadyCompleted.Error())
	case errors.Is(err, quest.ErrNotInProgress):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, quest.ErrNotInProgress.Error())
	case errors.Is(err, quest.ErrNotClaimable):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, quest.ErrNotClaimable.Error())
	case errors.Is(err, quest.ErrLevelTooLow):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "level too low")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, "quest operation failed")
	}
}
