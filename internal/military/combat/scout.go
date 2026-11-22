package combat

import (
	"context"
	"encoding/json"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ScoutObservation struct {
	PlayerID   int64
	X, Y       int
	Tier       int16
	TargetName string
	Detail     []byte
}

type ScoutReport struct {
	ReportID   int64
	X, Y       int
	Tier       int16
	TargetName string
	Detail     []byte
	CreatedAt  time.Time
}

func ScoutSinkPG(pool *pgxpool.Pool, serverID int32) func(context.Context, ScoutObservation) error {
	return func(ctx context.Context, obs ScoutObservation) error {
		if pool == nil {
			return nil
		}
		_, err := pool.Exec(ctx, `INSERT INTO scout_report(server_id,player_id,x,y,tier,target_name,detail)
			VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, serverID, obs.PlayerID, obs.X, obs.Y, obs.Tier, obs.TargetName, string(obs.Detail))
		return err
	}
}

func ListScoutReports(ctx context.Context, pool *pgxpool.Pool, serverID int32, playerID int64, limit int) ([]ScoutReport, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := pool.Query(ctx, `SELECT report_id,x,y,tier,target_name,detail::text,created_at FROM scout_report
		WHERE server_id=$1 AND player_id=$2 ORDER BY report_id DESC LIMIT $3`, serverID, playerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ScoutReport
	for rows.Next() {
		var r ScoutReport
		var raw string
		if err := rows.Scan(&r.ReportID, &r.X, &r.Y, &r.Tier, &r.TargetName, &raw, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Detail = []byte(raw)
		out = append(out, r)
	}
	return out, rows.Err()
}

func scoutDetail(tier int16, g *Garrison, scouts int) []byte {
	detail := map[string]any{"tier": tier, "scouts": scouts}
	if g != nil {
		detail["loot"] = map[string]int64{"food": g.Loot.Food, "wood": g.Loot.Wood, "stone": g.Loot.Stone, "iron": g.Loot.Iron, "gold": g.Loot.Gold}
		var total int
		for _, t := range g.Troops {
			total += int(t.Count)
		}
		detail["defender_troops"] = total
		if tier >= 2 {
			detail["hero_name"] = g.HeroName
			detail["hero_level"] = g.HeroLevel
		}
		if tier >= 3 {
			detail["troops"] = g.Troops
		}
		if tier >= 4 {
			detail["hero_force"] = g.HeroForce
			detail["hero_intel"] = g.HeroIntel
		}
	}
	raw, _ := json.Marshal(detail)
	return raw
}

func scoutCount(troops []march.TroopStack) int {
	scouts := 0
	for _, t := range troops {
		if t.UnitCfgID == 7 {
			scouts += int(t.Count)
		}
	}
	return scouts
}

func scoutTier(troops []march.TroopStack) int16 {
	tier := int16(1 + scoutCount(troops)/10)
	if tier > 4 {
		tier = 4
	}
	return tier
}
