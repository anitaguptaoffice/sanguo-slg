package api

import (
	"context"
	"errors"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/obs"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func (s *Server) handleCreateCity(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.CreateCityRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	serverID := req.GetServerId()
	if serverID == 0 {
		serverID = pc.ServerID
	}
	name := req.GetName()
	if name == "" {
		name = "MainCity"
	}
	x, y := int(req.GetX()), int(req.GetY())
	if x == 0 && y == 0 {
		x, y = 50, 50
	}
	cityID, err := s.players.nextCityID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	c := world.City{
		ServerID:  serverID,
		CityID:    cityID,
		PlayerID:  pc.PlayerID,
		Name:      name,
		X:         x,
		Y:         y,
		IsCapital: true,
		WallLevel: 1,
		Morale:    100,
	}
	if err := s.world.CreateCity(ctx, c); err != nil {
		if errors.Is(err, world.ErrOccupied) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "coordinate occupied"), nil
		}
		if errors.Is(err, world.ErrBadTerrain) || errors.Is(err, world.ErrOutOfBounds) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error()), nil
		}
		return nil, err
	}
	cityState := &domestic.CityState{
		ID:       cityID,
		PlayerID: pc.PlayerID,
		Wallet: domestic.Resources{
			Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000,
		},
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 1},
			"farm": {CfgID: 2, Level: 1},
		},
	}
	s.domestic.RegisterCity(cityState)
	s.cities[cityID] = cityState
	s.registerNewCity(cityState, x, y)
	summary := &apicommon.PlayerCitySummary{
		CityId: cityID, Name: name, X: int32(x), Y: int32(y),
		IsCapital: true, WallLevel: 1, Morale: 100,
	}
	data, err := marshal(&worldv1.CreateCityResponse{City: summary})
	if err != nil {
		return nil, err
	}
	obs.EmitGameplayEvent(s.log, pkt.GetTraceId(), obs.EventCreateCity, obs.PlayerRef{
		ServerID: serverID,
		PlayerID: pc.PlayerID,
	})
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListPlayerCities(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	cities, err := s.world.Store.PlayerCities(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	out := make([]*apicommon.PlayerCitySummary, 0, len(cities))
	for _, c := range cities {
		out = append(out, &apicommon.PlayerCitySummary{
			CityId: c.CityID, Name: c.Name, X: int32(c.X), Y: int32(c.Y),
			IsCapital: c.IsCapital, WallLevel: int32(c.WallLevel), Morale: int32(c.Morale),
		})
	}
	data, err := marshal(&worldv1.ListPlayerCitiesResponse{Cities: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
