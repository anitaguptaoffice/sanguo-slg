package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) equipmentService() *hero.EquipmentService {
	return hero.NewEquipment(s.PlayersPool(), s.now)
}

func equipmentProto(e hero.Equipment) *herov1.EquipmentView {
	return &herov1.EquipmentView{
		EquipmentId: e.ID, CfgId: e.CfgID, SlotType: e.SlotType, Tier: e.Tier, Name: e.Name,
		EnhanceLevel: e.EnhanceLevel, MaxEnhance: e.MaxEnhance, Gems: e.Gems,
		Attrs:    &herov1.HeroAttributes{Force: e.Force, Intel: e.Intel, Politics: e.Politics, Command: e.Command},
		SpeedPct: e.SpeedPct, Equipped: e.Equipped, HeroId: e.HeroID,
	}
}

func equipmentListProto(items []hero.Equipment) []*herov1.EquipmentView {
	out := make([]*herov1.EquipmentView, 0, len(items))
	for _, item := range items {
		out = append(out, equipmentProto(item))
	}
	return out
}

func (s *Server) handleGetHeroEquipment(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.GetHeroEquipmentRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	equipped, inventory, blacksmith, stable, err := s.equipmentService().List(ctx, pc.ServerID, pc.PlayerID, req.GetHeroId(), req.GetCityId())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.GetHeroEquipmentResponse{
		Equipped: equipmentListProto(equipped), Inventory: equipmentListProto(inventory),
		BlacksmithLevel: blacksmith, StableLevel: stable,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleForgeEquipment(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.ForgeEquipmentRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	item, gold, err := s.equipmentService().Forge(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetSlotType(), req.GetTier())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.ForgeEquipmentResponse{Equipment: equipmentProto(item), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleEnhanceEquipment(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.EnhanceEquipmentRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	item, gold, err := s.equipmentService().Enhance(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetEquipmentId())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.EnhanceEquipmentResponse{Equipment: equipmentProto(item), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSocketGem(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.SocketGemRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	item, gold, err := s.equipmentService().Socket(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetEquipmentId(), req.GetGemCfgId())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.SocketGemResponse{Equipment: equipmentProto(item), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleEquipItem(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.EquipItemRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	equipped, err := s.equipmentService().Equip(ctx, pc.ServerID, pc.PlayerID, req.GetHeroId(), req.GetCityId(), req.GetEquipmentId())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.EquipItemResponse{Equipped: equipmentListProto(equipped)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleUnequipItem(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.UnequipItemRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	equipped, err := s.equipmentService().Unequip(ctx, pc.ServerID, pc.PlayerID, req.GetHeroId(), req.GetCityId(), req.GetSlotType())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.UnequipItemResponse{Equipped: equipmentListProto(equipped)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleTrainMount(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.TrainMountRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	item, gold, err := s.equipmentService().TrainMount(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetEquipmentId())
	if err != nil {
		return equipmentErr(pkt, err), nil
	}
	data, err := marshal(&herov1.TrainMountResponse{Equipment: equipmentProto(item), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func equipmentErr(pkt *commonv1.ClientPacket, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrEquipmentGold), errors.Is(err, hero.ErrEquipmentIron):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold or iron")
	case errors.Is(err, hero.ErrEquipmentLevel):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "building level too low")
	case errors.Is(err, hero.ErrEquipmentMax), errors.Is(err, hero.ErrEquipmentSockets), errors.Is(err, hero.ErrEquipmentGem),
		errors.Is(err, hero.ErrEquipmentMount), errors.Is(err, hero.ErrEquipmentSlot):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid equipment state")
	case errors.Is(err, hero.ErrEquipmentOwner):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "equipment owner mismatch")
	}
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "equipment unavailable")
}
