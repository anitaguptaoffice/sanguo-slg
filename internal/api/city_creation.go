package api

import (
	"context"
	"crypto/sha256"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

// errCityCreationUnavailable reports a composition that cannot place a city atomically.
var errCityCreationUnavailable = errors.New("api: city creation unavailable")

// firstCityStarterWallet and firstCityStarterBuildings are the immutable starter
// content for a player's first city. They are shared by the legacy
// world.v1.CreateCity path and the first-city V2 effect so both insert identical
// bytes; FirstCityTemplateRef commits to exactly these values.
var firstCityStarterWallet = domestic.Resources{Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000}

var firstCityStarterBuildings = []struct {
	slot  string
	cfgID int32
	level int32
}{
	{"hall", 1, 1},
	{"farm", 2, 1},
}

func firstCityInitialState(playerID int64) *domestic.CityState {
	buildings := make(map[string]*domestic.BuildingInstance, len(firstCityStarterBuildings))
	for _, b := range firstCityStarterBuildings {
		buildings[b.slot] = &domestic.BuildingInstance{CfgID: b.cfgID, Level: b.level}
	}
	return &domestic.CityState{PlayerID: playerID, Wallet: firstCityStarterWallet, Buildings: buildings}
}

// firstCityTemplateContent is the player-independent canonical encoding of the
// starter content. It never contains a player id, so one template serves every actor.
func firstCityTemplateContent() []byte {
	out := make([]byte, 0, 256)
	out = append(out, `{"buildings":[`...)
	for i, b := range firstCityStarterBuildings {
		if i > 0 {
			out = append(out, ',')
		}
		out = append(out, `{"cfg_id":`...)
		out = appendInt(out, int64(b.cfgID))
		out = append(out, `,"level":`...)
		out = appendInt(out, int64(b.level))
		out = append(out, `,"slot":"`...)
		out = append(out, b.slot...)
		out = append(out, `"}`...)
	}
	out = append(out, `],"wallet":{"food":`...)
	out = appendInt(out, firstCityStarterWallet.Food)
	out = append(out, `,"iron":`...)
	out = appendInt(out, firstCityStarterWallet.Iron)
	out = append(out, `,"stone":`...)
	out = appendInt(out, firstCityStarterWallet.Stone)
	out = append(out, `,"wood":`...)
	out = appendInt(out, firstCityStarterWallet.Wood)
	out = append(out, "}}\n"...)
	return out
}

func appendInt(out []byte, value int64) []byte {
	if value == 0 {
		return append(out, '0')
	}
	var buf [20]byte
	i := len(buf)
	for value > 0 {
		i--
		buf[i] = byte('0' + value%10)
		value /= 10
	}
	return append(out, buf[i:]...)
}

// FirstCityTemplateRef returns the server-selected immutable template reference for
// first-city intake. catalogVersion identifies the spec data subset the starter
// content was reviewed against.
func FirstCityTemplateRef(catalogVersion string) *worldv1.FirstCityTemplateRef {
	sum := sha256.Sum256(firstCityTemplateContent())
	return &worldv1.FirstCityTemplateRef{
		TemplateVersion:        "fresh-city-v1",
		RulesVersion:           "city-creation-recovery-v1",
		CatalogVersion:         catalogVersion,
		ContentEncodingVersion: 1,
		ContentSha256:          sum[:],
	}
}

// createPlayerCity places one capital city for pc through the DOM/WORLD atomic
// creation path. Callers own request validation; error mapping stays with them.
func (s *Server) createPlayerCity(ctx context.Context, pc PlayerContext, name string, x, y int) (world.City, error) {
	if s.players == nil || s.domestic == nil || s.world == nil {
		return world.City{}, errCityCreationUnavailable
	}
	serverID := pc.ServerID
	if !s.domestic.SupportsAtomicCityCreation(s.players.Pool, serverID) {
		return world.City{}, errCityCreationUnavailable
	}
	if name == "" {
		name = "MainCity"
	}
	if x == 0 && y == 0 {
		x, y = 50, 50
	}
	c := world.City{
		ServerID:  serverID,
		PlayerID:  pc.PlayerID,
		Name:      name,
		X:         x,
		Y:         y,
		IsCapital: true,
		WallLevel: 1,
		Morale:    100,
	}
	cityID, err := s.domestic.CreateNewCity(ctx, serverID, firstCityInitialState(pc.PlayerID), func(ctx context.Context, tx pgx.Tx) (int64, error) {
		staged, err := s.world.CreateCityInTx(ctx, tx, c)
		if err == nil {
			c = staged
		}
		return staged.CityID, err
	})
	if err != nil {
		return world.City{}, err
	}
	s.cacheCity(cityID, s.citySnapshot(cityID))
	s.registerNewCity(cityID, c.X, c.Y)
	return c, nil
}
