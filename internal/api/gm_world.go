package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/meta"
	"github.com/jackc/pgx/v5"
)

// GmWorldPhase is the operator view of the server world phase.
type GmWorldPhase struct {
	ServerID       int32  `json:"server_id"`
	Phase          int16  `json:"phase"`
	Name           string `json:"name"`
	Unlock         string `json:"unlock"`
	OwnedCities    int64  `json:"owned_cities"`
	CampaignClears int64  `json:"campaign_clears"`
}

// GmSpecialCity is the operator view of one special city.
type GmSpecialCity struct {
	CfgID          int32  `json:"city_cfg_id"`
	CityType       int16  `json:"city_type"`
	Name           string `json:"name"`
	X              int    `json:"x"`
	Y              int    `json:"y"`
	OwnerGuildID   int64  `json:"owner_guild_id"`
	OwnerGuildName string `json:"owner_guild_name"`
	Garrison       int32  `json:"garrison"`
	MinPhase       int16  `json:"min_phase"`
}

// GmAchievement is the operator view of one achievement.
type GmAchievement struct {
	ID        int32  `json:"achievement_id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Metric    string `json:"metric"`
	Threshold int64  `json:"threshold"`
	Progress  int64  `json:"progress"`
	Claimed   bool   `json:"claimed"`
	CanClaim  bool   `json:"can_claim"`
}

// WorldPhase reads the current phase.
func (g *GmService) WorldPhase(ctx context.Context, token string, audit GmAudit, serverID int32) (GmOpResult, GmWorldPhase, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, GmWorldPhase{}, err
	}
	out, err := g.readWorldPhase(ctx, serverID)
	if err != nil {
		return GmOpResult{}, GmWorldPhase{}, err
	}
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "WorldPhase", op, "server_id", serverID, "phase", out.Phase)
	return op, out, nil
}

// SetWorldPhase forces the world phase for operations or testing.
func (g *GmService) SetWorldPhase(ctx context.Context, token string, audit GmAudit, serverID int32, phase int16) (GmOpResult, GmWorldPhase, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, GmWorldPhase{}, err
	}
	if phase < 1 || phase > 3 {
		return GmOpResult{}, GmWorldPhase{}, fmt.Errorf("gm: phase must be 1..3")
	}
	if _, err := g.pool.Exec(ctx, `INSERT INTO world_phase_state(server_id,phase,updated_at)
		VALUES($1,$2,$3) ON CONFLICT (server_id) DO UPDATE SET phase=EXCLUDED.phase,updated_at=EXCLUDED.updated_at`,
		serverID, phase, g.now()); err != nil {
		return GmOpResult{}, GmWorldPhase{}, err
	}
	out, err := g.readWorldPhase(ctx, serverID)
	if err != nil {
		return GmOpResult{}, GmWorldPhase{}, err
	}
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "SetWorldPhase", op, "server_id", serverID, "phase", phase)
	return op, out, nil
}

func (g *GmService) readWorldPhase(ctx context.Context, serverID int32) (GmWorldPhase, error) {
	out := GmWorldPhase{ServerID: serverID, Phase: 1}
	_ = g.pool.QueryRow(ctx, `SELECT COALESCE((SELECT phase FROM world_phase_state WHERE server_id=$1),1)`,
		serverID).Scan(&out.Phase)
	_ = g.pool.QueryRow(ctx, `SELECT COALESCE(name,''),COALESCE(unlock_desc,'') FROM cfg_world_phase WHERE phase=$1`,
		out.Phase).Scan(&out.Name, &out.Unlock)
	_ = g.pool.QueryRow(ctx, `SELECT count(*) FROM special_city_state WHERE server_id=$1 AND owner_guild_id>0`,
		serverID).Scan(&out.OwnedCities)
	_ = g.pool.QueryRow(ctx, `SELECT count(*) FROM player_campaign_progress WHERE server_id=$1 AND cleared_at IS NOT NULL`,
		serverID).Scan(&out.CampaignClears)
	return out, nil
}

// ListSpecialCities lists configured cities and current ownership.
func (g *GmService) ListSpecialCities(ctx context.Context, token string, audit GmAudit, serverID int32) (GmOpResult, []GmSpecialCity, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, nil, err
	}
	rows, err := g.pool.Query(ctx, `SELECT c.city_cfg_id,c.city_type,c.name,c.x,c.y,
		COALESCE(st.owner_guild_id,0),COALESCE(gu.name,''),c.min_phase,COALESCE(st.garrison,c.garrison)
		FROM cfg_special_city c
		LEFT JOIN special_city_state st ON st.server_id=$1 AND st.city_cfg_id=c.city_cfg_id
		LEFT JOIN guild gu ON gu.server_id=$1 AND gu.guild_id=st.owner_guild_id
		ORDER BY c.city_cfg_id`, serverID)
	if err != nil {
		return GmOpResult{}, nil, err
	}
	defer rows.Close()
	var out []GmSpecialCity
	for rows.Next() {
		var city GmSpecialCity
		var garrison []byte
		if err := rows.Scan(&city.CfgID, &city.CityType, &city.Name, &city.X, &city.Y,
			&city.OwnerGuildID, &city.OwnerGuildName, &city.MinPhase, &garrison); err != nil {
			return GmOpResult{}, nil, err
		}
		city.Garrison = garrisonTotal(garrison)
		out = append(out, city)
	}
	if err := rows.Err(); err != nil {
		return GmOpResult{}, nil, err
	}
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "ListSpecialCities", op, "server_id", serverID, "count", len(out))
	return op, out, nil
}

// SetSpecialCityOwner transfers a special city to a guild (0 = neutral).
func (g *GmService) SetSpecialCityOwner(ctx context.Context, token string, audit GmAudit, serverID int32, cfgID int32, guildID int64) (GmOpResult, GmSpecialCity, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, GmSpecialCity{}, err
	}
	var exists bool
	if err := g.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM cfg_special_city WHERE city_cfg_id=$1)`, cfgID).Scan(&exists); err != nil {
		return GmOpResult{}, GmSpecialCity{}, err
	}
	if !exists {
		return GmOpResult{}, GmSpecialCity{}, fmt.Errorf("gm: special city not found")
	}
	if guildID > 0 {
		if err := g.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM guild WHERE server_id=$1 AND guild_id=$2)`,
			serverID, guildID).Scan(&exists); err != nil {
			return GmOpResult{}, GmSpecialCity{}, err
		}
		if !exists {
			return GmOpResult{}, GmSpecialCity{}, fmt.Errorf("gm: guild not found")
		}
	}
	if _, err := g.pool.Exec(ctx, `INSERT INTO special_city_state(server_id,city_cfg_id,owner_guild_id,garrison,occupied_at,next_recover_at)
		VALUES($1,$2,$3::bigint,NULL,CASE WHEN $3::bigint>0 THEN $4::timestamptz ELSE NULL END,NULL)
		ON CONFLICT (server_id,city_cfg_id) DO UPDATE SET owner_guild_id=EXCLUDED.owner_guild_id,
			garrison=NULL,occupied_at=EXCLUDED.occupied_at,next_recover_at=NULL`,
		serverID, cfgID, guildID, g.now()); err != nil {
		return GmOpResult{}, GmSpecialCity{}, err
	}
	_, cities, err := g.ListSpecialCities(ctx, token, audit, serverID)
	if err != nil {
		return GmOpResult{}, GmSpecialCity{}, err
	}
	for _, city := range cities {
		if city.CfgID == cfgID {
			op := newGmOpResult(audit, g.now())
			logGmOp(g.log, "SetSpecialCityOwner", op, "server_id", serverID, "city_cfg_id", cfgID, "guild_id", guildID)
			return op, city, nil
		}
	}
	return GmOpResult{}, GmSpecialCity{}, fmt.Errorf("gm: special city not found after update")
}

// ListAchievements lists achievement progress for one player.
func (g *GmService) ListAchievements(ctx context.Context, token string, audit GmAudit, serverID int32, playerID int64) (GmOpResult, []GmAchievement, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, nil, err
	}
	if _, err := lookupPlayerRow(ctx, g.pool, serverID, playerID, ""); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GmOpResult{}, nil, fmt.Errorf("gm: player not found")
		}
		return GmOpResult{}, nil, err
	}
	views, err := meta.New(g.pool, g.now).List(ctx, serverID, playerID)
	if err != nil {
		return GmOpResult{}, nil, err
	}
	out := make([]GmAchievement, 0, len(views))
	for _, v := range views {
		out = append(out, GmAchievement{ID: v.ID, Code: v.Code, Name: v.Name, Metric: v.Metric,
			Threshold: v.Threshold, Progress: v.Progress, Claimed: v.Claimed, CanClaim: v.CanClaim})
	}
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "ListAchievements", op, "server_id", serverID, "player_id", playerID, "count", len(out))
	return op, out, nil
}

// ResetAchievement clears a claimed achievement so it can be re-tested.
func (g *GmService) ResetAchievement(ctx context.Context, token string, audit GmAudit, serverID int32, playerID int64, achievementID int32) (GmOpResult, bool, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, false, err
	}
	if _, err := lookupPlayerRow(ctx, g.pool, serverID, playerID, ""); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GmOpResult{}, false, fmt.Errorf("gm: player not found")
		}
		return GmOpResult{}, false, err
	}
	tag, err := g.pool.Exec(ctx, `DELETE FROM player_achievement WHERE server_id=$1 AND player_id=$2 AND achievement_id=$3`,
		serverID, playerID, achievementID)
	if err != nil {
		return GmOpResult{}, false, err
	}
	reset := tag.RowsAffected() > 0
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "ResetAchievement", op, "server_id", serverID, "player_id", playerID,
		"achievement_id", achievementID, "reset", reset)
	return op, reset, nil
}

func garrisonTotal(raw []byte) int32 {
	var m map[string]int32
	if len(raw) == 0 || json.Unmarshal(raw, &m) != nil {
		return 0
	}
	var total int32
	for _, n := range m {
		total += n
	}
	return total
}
