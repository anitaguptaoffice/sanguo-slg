package api

import (
	"context"
	"errors"

	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
)

func prestigeProto(v rank.PrestigeView) *rankv1.PrestigeView {
	return &rankv1.PrestigeView{Prestige: v.Prestige, RankLevel: int32(v.RankLevel),
		CityCap: v.CityCap, NextPrestige: v.NextPrestige, NextCap: v.NextCap}
}

func (s *Server) prestigeService() *rank.PrestigeService {
	return rank.NewPrestigeService(s.PlayersPool(), s.now)
}

func (s *Server) handleGetPlayerRank(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req rankv1.GetPlayerRankRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	view, err := s.prestigeService().Get(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	data, err := marshal(&rankv1.GetPlayerRankResponse{Rank: prestigeProto(view)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handlePromoteRank(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req rankv1.PromoteRankRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	view, err := s.prestigeService().Promote(ctx, pc.ServerID, pc.PlayerID, req.GetCityId())
	if err != nil {
		switch {
		case errors.Is(err, rank.ErrRankPrestige):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "insufficient prestige"), nil
		case errors.Is(err, rank.ErrRankHall):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "hall level too low"), nil
		case errors.Is(err, rank.ErrRankGold), errors.Is(err, rank.ErrRankItem):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold or jewel"), nil
		case errors.Is(err, rank.ErrRankMax):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "already at max rank"), nil
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "rank unavailable"), nil
	}
	var gold int64
	_ = s.PlayersPool().QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2`,
		pc.ServerID, pc.PlayerID).Scan(&gold)
	data, err := marshal(&rankv1.PromoteRankResponse{Rank: prestigeProto(view), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
