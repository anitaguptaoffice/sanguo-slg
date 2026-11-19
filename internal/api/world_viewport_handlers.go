package api

import (
	"context"
	"math"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

const (
	// RouteGetWorldViewport returns the full-screen world map viewport.
	RouteGetWorldViewport = "world.v1.GetWorldViewport"
	// RouteGetWorldTileDetail returns one tile's detail and available actions.
	RouteGetWorldTileDetail = "world.v1.GetWorldTileDetail"
	// maxViewportRadius bounds one viewport query to 81×81 tiles.
	maxViewportRadius = 40
)

func (s *Server) handleGetWorldViewport(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.GetWorldViewportRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	rx, ry := clampRadius(int(req.GetRadiusX())), clampRadius(int(req.GetRadiusY()))
	tiles, marches, err := s.world.Viewport(ctx, pc.ServerID, int(req.GetCenterX()), int(req.GetCenterY()), rx, ry)
	if err != nil {
		return nil, err
	}
	out := &worldv1.GetWorldViewportResponse{Tiles: make([]*worldv1.WorldTileSummary, 0, len(tiles))}
	for _, tile := range tiles {
		out.Tiles = append(out.Tiles, worldTileSummary(tile))
	}
	for _, line := range marches {
		out.Marches = append(out.Marches, &worldv1.WorldMarchLine{
			MarchId: line.MarchID, FromX: int32(line.FromX), FromY: int32(line.FromY),
			ToX: int32(line.ToX), ToY: int32(line.ToY), Phase: int32(line.Phase),
			ArriveAtMs: line.ArriveAt.UnixMilli(), OwnerPlayerId: line.OwnerID,
		})
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetWorldTileDetail(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.GetWorldTileDetailRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	tile, err := s.world.TileDetail(ctx, pc.ServerID, int(req.GetX()), int(req.GetY()))
	if err != nil {
		return nil, err
	}
	if tile == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "tile out of bounds"), nil
	}
	out := &worldv1.GetWorldTileDetailResponse{
		Tile:                 worldTileSummary(*tile),
		Actions:              worldTileActions(pc.PlayerID, *tile),
		GarrisonTier:         worldGarrisonTier(s.world.Wild, tile.Cell),
		ResourceBonusPercent: worldPrimaryBonus(s.world.Wild, tile.Cell),
		DistanceFromCapital:  s.distanceFromCapital(ctx, pc, tile.X, tile.Y),
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func clampRadius(value int) int {
	if value < 0 {
		return 0
	}
	if value > maxViewportRadius {
		return maxViewportRadius
	}
	return value
}

func worldTileSummary(tile world.TileView) *worldv1.WorldTileSummary {
	summary := &worldv1.WorldTileSummary{
		X: int32(tile.X), Y: int32(tile.Y), Terrain: int32(tile.Terrain),
		Level: int32(tile.Level), MaxLevel: int32(tile.MaxLevel),
		ProvinceId: int32(tile.ProvinceID), NpcKind: int32(tile.NpcKind),
		OwnerPlayerId: tile.OwnerPlayerID, OwnerCityId: tile.OwnerCityID,
		OwnerName: tile.OwnerName,
	}
	if tile.ProvinceID >= 1 && int(tile.ProvinceID) <= len(world.ProvinceNames) {
		summary.ProvinceName = world.ProvinceNames[tile.ProvinceID-1]
	}
	if tile.NpcKind == 1 {
		summary.NpcLevel = int32(tile.Level)
	}
	return summary
}

// worldTileActions lists the player-visible actions for one tile. Later slices
// gate the gameplay behind each action; R1-S1 only advertises the menu.
func worldTileActions(viewerID int64, tile world.TileView) []string {
	if tile.Terrain == world.TerrainCity {
		if tile.OwnerPlayerID == viewerID {
			return []string{"进入主城"}
		}
		return []string{"查看详情"}
	}
	if tile.OwnerPlayerID == viewerID && tile.OwnerCityID != 0 {
		return []string{"查看详情", "派遣驻军", "采集寻宝", "放弃野地"}
	}
	if tile.NpcKind == 1 {
		return []string{"查看详情", "讨伐掠夺"}
	}
	return []string{"查看详情", "占领", "掠夺"}
}

func worldGarrisonTier(cfg *world.WildConfig, cell world.Cell) int32 {
	profile := cfg.Profile(cell)
	if profile == nil {
		return 0
	}
	var total int32
	for _, troop := range profile.Troops {
		total += troop.Count
	}
	tier := 1 + total/200
	if tier > 10 {
		tier = 10
	}
	return tier
}

func worldPrimaryBonus(cfg *world.WildConfig, cell world.Cell) int32 {
	terrain := cfg.Terrain(cell.Terrain)
	if terrain == nil || cell.NpcKind == 1 {
		return 0
	}
	bonus := terrain.BonusPercent
	return int32(math.Max(math.Max(float64(bonus.Food), float64(bonus.Wood)),
		math.Max(math.Max(float64(bonus.Stone), float64(bonus.Iron)), float64(bonus.Gold))))
}

func (s *Server) distanceFromCapital(ctx context.Context, pc PlayerContext, x, y int) int32 {
	cities, err := s.world.Store.PlayerCities(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return 0
	}
	for _, city := range cities {
		if city.IsCapital {
			return int32(abs(city.X-x) + abs(city.Y-y))
		}
	}
	return 0
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
