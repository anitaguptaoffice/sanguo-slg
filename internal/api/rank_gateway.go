package api

import (
	"context"
	"errors"

	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const RouteGetLeaderboard = "rank.v1.GetLeaderboard"

func rankGatewayHandlers(svc *rank.Service, sessions *SessionRegistry) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteGetLeaderboard: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleGetLeaderboard(ctx, pkt, svc, sessions)
		},
	}
}

func handleGetLeaderboard(ctx context.Context, pkt *commonv1.ClientPacket, svc *rank.Service, sessions *SessionRegistry) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	pc, ok := sessions.Get(pkt.GetSessionId())
	if !ok || pc.ServerID == 0 {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session required"), nil
	}
	var req rankv1.GetLeaderboardRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	serverID := req.GetServerId()
	if serverID == 0 {
		serverID = pc.ServerID
	}
	if serverID != pc.ServerID {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if sid := pkt.GetServerId(); sid != 0 && sid != pc.ServerID {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	rt, err := protoRankType(req.GetType())
	if err != nil {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error()), nil
	}
	page, err := svc.GetLeaderboard(ctx, rank.LeaderboardQuery{
		ServerID:       serverID,
		Type:           rt,
		Page:           req.GetPage(),
		PageSize:       req.GetPageSize(),
		ViewerPlayerID: pc.PlayerID,
	})
	if err != nil {
		return rankServiceErr(trace, err), nil
	}
	data, err := proto.Marshal(leaderboardToProto(page))
	if err != nil {
		return nil, err
	}
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}, nil
}

func protoRankType(t rankv1.LeaderboardType) (rank.RankType, error) {
	switch t {
	case rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER:
		return rank.RankPlayerPower, nil
	case rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE:
		return rank.RankPlayerResource, nil
	default:
		return 0, rank.ErrUnknownRankType
	}
}

func leaderboardToProto(page rank.LeaderboardPage) *rankv1.GetLeaderboardResponse {
	out := &rankv1.GetLeaderboardResponse{
		Type:                  rankTypeToProto(page.Type),
		TotalCount:            page.TotalCount,
		MyRank:                page.MyRank,
		MyScore:               page.MyScore,
		SnapshotVersion:       page.SnapshotVersion,
		SnapshotRefreshedAtMs: page.SnapshotRefreshedAtMs,
	}
	for _, e := range page.Entries {
		out.Entries = append(out.Entries, &rankv1.LeaderboardEntry{
			Rank:        e.Position,
			EntityId:    e.SubjectID,
			DisplayName: e.DisplayName,
			Score:       e.Score,
			GuildName:   e.GuildName,
		})
	}
	return out
}

func rankTypeToProto(t rank.RankType) rankv1.LeaderboardType {
	switch t {
	case rank.RankPlayerPower:
		return rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER
	case rank.RankPlayerResource:
		return rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE
	default:
		return rankv1.LeaderboardType_LEADERBOARD_TYPE_UNSPECIFIED
	}
}

func rankServiceErr(trace string, err error) *commonv1.ServerPacket {
	if errors.Is(err, rank.ErrUnknownRankType) {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	}
	if errors.Is(err, rank.ErrNoSnapshot) {
		return rankErrResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "no leaderboard snapshot; refresh pending")
	}
	return rankErrResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
}

func rankErrResp(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{
		Code:    int32(code),
		Msg:     msg,
		TraceId: trace,
	}
}
