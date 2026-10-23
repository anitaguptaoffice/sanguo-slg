package api

import (
	"context"
	"errors"

	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/obs"
)

const (
	RouteListPlayerQuests   = "quest.v1.ListPlayerQuests"
	RouteAcceptQuest        = "quest.v1.AcceptQuest"
	RouteReportQuestProgress = "quest.v1.ReportQuestProgress"
	RouteClaimQuestReward   = "quest.v1.ClaimQuestReward"
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
	chains := s.questChainIDs
	if req.GetChainId() != 0 {
		chains = []int32{req.GetChainId()}
	}
	var quests []*questv1.PlayerQuestProgress
	var chainViews []*questv1.QuestChainStatus
	for _, cid := range chains {
		st, views, err := s.questSvc.GetQuestChainStatus(ctx, actor, cid)
		if err != nil {
			return nil, err
		}
		chainViews = append(chainViews, questChainToProto(st))
		for _, v := range views {
			if !req.GetIncludeCompleted() && v.State == quest.PlayerQuestStateCompleted {
				continue
			}
			quests = append(quests, questProgressToProto(v))
		}
	}
	data, err := marshal(&questv1.ListPlayerQuestsResponse{Quests: quests, Chains: chainViews})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
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
	q, chain, err := s.questSvc.AcceptQuest(ctx, quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetQuestCfgId())
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
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req questv1.ReportQuestProgressRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	q, chain, err := s.questSvc.ReportQuestProgress(ctx, quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
		req.GetQuestCfgId(), req.GetAbsolute(), req.GetProgressValue())
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&questv1.ReportQuestProgressResponse{
		Quest: questProgressToProto(q),
		Chain: questChainToProto(chain),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
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
	q, chain, granted, err := s.questSvc.ClaimQuestReward(ctx, quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetQuestCfgId())
	if err != nil {
		return questErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&questv1.ClaimQuestRewardResponse{
		Quest:           questProgressToProto(q),
		Chain:           questChainToProto(chain),
		GrantedRewards:  rewardBundleToProto(granted),
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
	st, views, err := s.questSvc.GetQuestChainStatus(ctx, quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetChainId())
	if err != nil {
		return nil, err
	}
	pbViews := make([]*questv1.PlayerQuestProgress, 0, len(views))
	for _, v := range views {
		pbViews = append(pbViews, questProgressToProto(v))
	}
	data, err := marshal(&questv1.GetQuestChainStatusResponse{
		Chain:        questChainToProto(st),
		ChainQuests:  pbViews,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func questErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, quest.ErrQuestNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "quest not found")
	case errors.Is(err, quest.ErrPrerequisiteNotMet):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "prerequisite not met")
	case errors.Is(err, quest.ErrAlreadyAccepted), errors.Is(err, quest.ErrAlreadyCompleted):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, quest.ErrNotInProgress), errors.Is(err, quest.ErrNotClaimable):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, quest.ErrLevelTooLow):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "level too low")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}
