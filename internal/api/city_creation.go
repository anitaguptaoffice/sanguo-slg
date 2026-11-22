package api

import (
	"context"
	"crypto/sha256"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

// errCityCreationUnavailable reports a composition that cannot place a city atomically.
var (
	errCityCreationUnavailable = errors.New("api: city creation unavailable")
	errCityCap                 = errors.New("api: city cap reached")
	errCityTerrain             = errors.New("api: new city requires plain terrain")
	errCityCost                = errors.New("api: insufficient city founding cost")
)

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

// initializeDurableCity gives a freshly created city the durable MIL origin and
// the four garrison rows the durable recruit/march path expects. It runs in the
// caller's creation transaction so a city is never published half-initialized.
func (s *Server) initializeDurableCity(ctx context.Context, tx pgx.Tx, playerID, cityID int64) error {
	if s.milDurable == nil {
		return nil
	}
	profile := s.milDurable.Profile()
	if _, err := tx.Exec(ctx, `
		INSERT INTO mil_city_origin (server_id, city_id, owner_player_id, cohort_id, format_version, created_at)
		SELECT $1, $2, $3, $4, 1, date_trunc('milliseconds', now())
		WHERE NOT EXISTS (SELECT 1 FROM mil_city_origin WHERE server_id = $1 AND city_id = $2)`,
		profile.ServerID, cityID, playerID, profile.Cohort[:]); err != nil {
		return err
	}
	for unit := int32(1); unit <= 12; unit++ {
		if _, err := tx.Exec(ctx, `
			INSERT INTO city_troop (server_id, city_id, unit_cfg_id, count, wounded)
			VALUES ($1, $2, $3, 0, 0)
			ON CONFLICT (server_id, city_id, unit_cfg_id) DO NOTHING`,
			profile.ServerID, cityID, unit); err != nil {
			return err
		}
	}
	return nil
}

// initializeMonarch creates the player's unique monarch hero in the city
// creation transaction. Re-running keeps the existing monarch untouched.
func initializeMonarch(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64) error {
	var ready bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('player_hero_id_seq') IS NOT NULL
		AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
			WHERE c.relname='player_hero' AND a.attname='is_monarch' AND a.attnum>0 AND NOT a.attisdropped)`).Scan(&ready); err != nil {
		return err
	}
	if !ready {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO player_hero
		(server_id,hero_id,player_id,template_cfg_id,display_name,level,exp,loyalty,
		 force,intel,politics,command,status,created_at,is_monarch)
		SELECT $1,nextval('player_hero_id_seq'),$2,9900,COALESCE(p.display_name,'君主')||'·君主',1,0,100,
		 COALESCE((t.base_stats->>'force')::int,0),COALESCE((t.base_stats->>'intel')::int,0),
		 COALESCE((t.base_stats->>'politics')::int,0),COALESCE((t.base_stats->>'command')::int,0),
		 1,now(),true
		FROM player p LEFT JOIN cfg_hero_template t ON t.template_cfg_id=9900
		WHERE p.server_id=$1 AND p.player_id=$2
		AND NOT EXISTS (SELECT 1 FROM player_hero h WHERE h.server_id=$1 AND h.player_id=$2 AND h.is_monarch)`,
		serverID, playerID)
	return err
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
	var existing int64
	if err := s.players.Pool.QueryRow(ctx, `SELECT city_id FROM player_city WHERE server_id=$1 AND player_id=$2 AND x=$3 AND y=$4`,
		serverID, pc.PlayerID, x, y).Scan(&existing); err == nil {
		return world.City{}, world.ErrOccupied
	}
	var cityCount int
	if err := s.players.Pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=$1 AND player_id=$2`,
		serverID, pc.PlayerID).Scan(&cityCount); err != nil {
		return world.City{}, err
	}
	prestige, err := rank.NewPrestigeService(s.players.Pool, s.now).Get(ctx, serverID, pc.PlayerID)
	if err != nil {
		return world.City{}, err
	}
	if int32(cityCount) >= prestige.CityCap {
		return world.City{}, errCityCap
	}
	if cityCount > 0 {
		var terrain int16
		if err := s.players.Pool.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3`,
			serverID, x, y).Scan(&terrain); err != nil || terrain != 1 {
			return world.City{}, errCityTerrain
		}
	}
	c := world.City{
		ServerID:  serverID,
		PlayerID:  pc.PlayerID,
		Name:      name,
		X:         x,
		Y:         y,
		IsCapital: cityCount == 0,
		WallLevel: 1,
		Morale:    100,
	}
	cityID, err := s.domestic.CreateNewCity(ctx, serverID, firstCityInitialState(pc.PlayerID), func(ctx context.Context, tx pgx.Tx) (int64, error) {
		staged, err := s.world.CreateCityInTx(ctx, tx, c)
		if err != nil {
			return 0, err
		}
		c = staged
		if err := s.initializeDurableCity(ctx, tx, pc.PlayerID, staged.CityID); err != nil {
			return 0, err
		}
		if err := initializeMonarch(ctx, tx, serverID, pc.PlayerID); err != nil {
			return 0, err
		}
		if !c.IsCapital {
			tag, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food-2000,wood=wood-2000,stone=stone-2000,iron=iron-2000
				WHERE server_id=$1 AND player_id=$2 AND food>=2000 AND wood>=2000 AND stone>=2000 AND iron>=2000`,
				serverID, pc.PlayerID)
			if err != nil {
				return 0, err
			}
			if tag.RowsAffected() != 1 {
				return 0, errCityCost
			}
		}
		return staged.CityID, nil
	})
	if err != nil {
		return world.City{}, err
	}
	s.cacheCity(cityID, s.citySnapshot(cityID))
	s.registerNewCity(cityID, c.X, c.Y)
	return c, nil
}
