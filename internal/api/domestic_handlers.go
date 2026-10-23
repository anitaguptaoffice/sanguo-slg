package api

import (
	"context"
	"errors"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleStartBuildingUpgrade(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	_, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.StartBuildingUpgradeRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	res, err := s.domestic.StartBuildingUpgrade(req.GetCityId(), req.GetSlotKey(), req.GetBuildingCfgId())
	if err != nil {
		if errors.Is(err, domestic.ErrCityNotFound) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
		}
		if errors.Is(err, domestic.ErrInsufficientRes) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient resources"), nil
		}
		if errors.Is(err, domestic.ErrUnknownBuilding) || errors.Is(err, domestic.ErrInvalidUpgrade) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, err.Error()), nil
		}
		return nil, err
	}
	city := s.cities[req.GetCityId()]
	level := int32(1)
	if city != nil {
		if inst := city.Buildings[req.GetSlotKey()]; inst != nil {
			level = inst.Level
		}
	}
	finishMS := int64(0)
	if !res.FinishAt.IsZero() {
		finishMS = res.FinishAt.UnixMilli()
	}
	data, err := marshal(&domesticv1.StartBuildingUpgradeResponse{
		Building: &apicommon.CityBuilding{
			SlotKey:             req.GetSlotKey(),
			BuildingCfgId:       req.GetBuildingCfgId(),
			Level:               level,
			UpgradeFinishAtMs: finishMS,
		},
		Wallet:     walletProto(res.Wallet),
		QueueId:    res.JobID,
		FinishAtMs: finishMS,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetCityState(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.GetCityStateRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	city := s.cities[req.GetCityId()]
	if city == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	s.accrueCityWithQuest(ctx, pc.ServerID, city, domestic.DefaultCatalog(), s.now())
	buildings := make([]*apicommon.CityBuilding, 0, len(city.Buildings))
	for slot, inst := range city.Buildings {
		buildings = append(buildings, &apicommon.CityBuilding{
			SlotKey:       slot,
			BuildingCfgId: inst.CfgID,
			Level:         inst.Level,
		})
	}
	data, err := marshal(&domesticv1.GetCityStateResponse{
		Wallet:    walletProto(city.Wallet),
		Buildings: buildings,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func walletProto(w domestic.Resources) *apicommon.ResourceWallet {
	return &apicommon.ResourceWallet{
		Food: w.Food, Wood: w.Wood, Iron: w.Iron, Stone: w.Stone,
	}
}
