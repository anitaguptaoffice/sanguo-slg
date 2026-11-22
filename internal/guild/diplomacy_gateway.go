package guild

import (
	"context"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteSetGuildRelation      = "guild.v1.SetGuildRelation"
	RouteListGuildRelations    = "guild.v1.ListGuildRelations"
	RouteStationGuildTroops    = "guild.v1.StationGuildTroops"
	RouteListGuildGarrison     = "guild.v1.ListGuildGarrison"
	RouteWithdrawGuildGarrison = "guild.v1.WithdrawGuildGarrison"
)

func RegisterDiplomacy(m *assembly.M3, d *Diplomacy, sessions SessionResolver) {
	if m == nil || d == nil {
		return
	}
	actor := func(ctx context.Context, pkt *commonv1.ClientPacket) (Actor, *commonv1.ServerPacket, error) {
		a, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
		return a, nil, err
	}
	m.Register(RouteSetGuildRelation, func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		a, errPkt, err := actor(ctx, pkt)
		if err != nil {
			return errPkt, nil
		}
		var req guildv1.SetGuildRelationRequest
		if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		view, err := d.SetRelation(ctx, a.ServerID, a.PlayerID, req.GetGuildId(), req.GetTargetGuildId(), req.GetState())
		if err != nil {
			return guildErr(pkt.GetTraceId(), err), nil
		}
		data, err := proto.Marshal(&guildv1.SetGuildRelationResponse{Relation: view})
		if err != nil {
			return nil, err
		}
		return okResp(pkt.GetTraceId(), data), nil
	})
	m.Register(RouteListGuildRelations, func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		a, errPkt, err := actor(ctx, pkt)
		if err != nil {
			return errPkt, nil
		}
		var req guildv1.ListGuildRelationsRequest
		if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		rows, err := d.ListRelations(ctx, a.ServerID, req.GetGuildId())
		if err != nil {
			return nil, err
		}
		data, err := proto.Marshal(&guildv1.ListGuildRelationsResponse{Relations: rows})
		if err != nil {
			return nil, err
		}
		return okResp(pkt.GetTraceId(), data), nil
	})
	m.Register(RouteStationGuildTroops, func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		a, errPkt, err := actor(ctx, pkt)
		if err != nil {
			return errPkt, nil
		}
		var req guildv1.StationGuildTroopsRequest
		if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		rows, err := d.Station(ctx, a.ServerID, a.PlayerID, req.GetFromCityId(), req.GetCityId(),
			req.GetGuildId(), req.GetUnitCfgId(), req.GetCount())
		if err != nil {
			return guildErr(pkt.GetTraceId(), err), nil
		}
		data, err := proto.Marshal(&guildv1.StationGuildTroopsResponse{Troops: rows})
		if err != nil {
			return nil, err
		}
		return okResp(pkt.GetTraceId(), data), nil
	})
	m.Register(RouteWithdrawGuildGarrison, func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		a, errPkt, err := actor(ctx, pkt)
		if err != nil {
			return errPkt, nil
		}
		var req guildv1.WithdrawGuildGarrisonRequest
		if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		rows, err := d.Withdraw(ctx, a.ServerID, a.PlayerID, req.GetCityId(), req.GetToCityId(),
			req.GetGuildId(), req.GetUnitCfgId(), req.GetCount())
		if err != nil {
			return guildErr(pkt.GetTraceId(), err), nil
		}
		data, err := proto.Marshal(&guildv1.WithdrawGuildGarrisonResponse{Troops: rows})
		if err != nil {
			return nil, err
		}
		return okResp(pkt.GetTraceId(), data), nil
	})
	m.Register(RouteListGuildGarrison, func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		a, errPkt, err := actor(ctx, pkt)
		if err != nil {
			return errPkt, nil
		}
		var req guildv1.ListGuildGarrisonRequest
		if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		rows, err := d.ListGarrison(ctx, a.ServerID, req.GetCityId())
		if err != nil {
			return nil, err
		}
		data, err := proto.Marshal(&guildv1.ListGuildGarrisonResponse{Troops: rows})
		if err != nil {
			return nil, err
		}
		return okResp(pkt.GetTraceId(), data), nil
	})
}
