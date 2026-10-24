package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

type heroHotelCity struct{ srv *Server }

func (s *Server) heroHotelCityPort() hero.HotelCityPort {
	if s == nil {
		return nil
	}
	return &heroHotelCity{srv: s}
}

func (h *heroHotelCity) buildingLevel(ctx context.Context, serverID int32, cityID int64, cfgID int32) (int32, error) {
	if h.srv.players == nil || h.srv.players.Pool == nil {
		return 0, nil
	}
	var level int32
	err := h.srv.players.Pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(level), 0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`,
		serverID, cityID, cfgID).Scan(&level)
	return level, err
}

func (h *heroHotelCity) HotelLevel(ctx context.Context, serverID int32, cityID int64) (int32, error) {
	return h.buildingLevel(ctx, serverID, cityID, hero.BuildingCfgHotel)
}

func (h *heroHotelCity) OfficeLevel(ctx context.Context, serverID int32, cityID int64) (int32, error) {
	return h.buildingLevel(ctx, serverID, cityID, hero.BuildingCfgHeroOffice)
}

func (h *heroHotelCity) SpendGold(ctx context.Context, p hero.PlayerRef, amount int64) error {
	if amount <= 0 {
		return nil
	}
	w := h.srv.newShopWalletStore()
	if w == nil {
		return hero.ErrInsufficientGold
	}
	ref := content.PlayerRef{ServerID: p.ServerID, PlayerID: p.PlayerID}
	_, err := w.Spend(ctx, ref, content.ResourceWallet{Gold: amount})
	if err != nil {
		if errors.Is(err, shop.ErrInsufficientBalance) {
			return hero.ErrInsufficientGold
		}
		return err
	}
	return nil
}

func (h *heroHotelCity) SpendItem(ctx context.Context, p hero.PlayerRef, itemCfgID int32, qty int32) error {
	if h.srv.contentSvc == nil {
		return hero.ErrInsufficientItem
	}
	ref := content.PlayerRef{ServerID: p.ServerID, PlayerID: p.PlayerID}
	if err := h.srv.contentSvc.LoadPlayer(ctx, ref); err != nil {
		return err
	}
	if _, err := h.srv.contentSvc.Remove(ref, itemCfgID, qty); err != nil {
		if errors.Is(err, content.ErrInsufficientItems) {
			return hero.ErrInsufficientItem
		}
		return err
	}
	return nil
}
