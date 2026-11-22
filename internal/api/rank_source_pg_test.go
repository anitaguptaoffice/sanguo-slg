package api

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
)

func TestPGRankSourceAllTypes(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(95,'rank95','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name,power) VALUES(1,95,95,'榜单玩家',900) ON CONFLICT (server_id,player_id) DO UPDATE SET power=900;
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,level,force,intel,politics,command,status)
			VALUES(1,950,95,9900,10,120,110,100,90,1) ON CONFLICT (server_id,hero_id) DO UPDATE SET force=120,intel=110,politics=100,command=90;
		INSERT INTO player_rank(server_id,player_id,prestige,rank_level) VALUES(1,95,777,2)
			ON CONFLICT (server_id,player_id) DO UPDATE SET prestige=777;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count,power) VALUES(1,95,'榜单盟',95,1,5000)
			ON CONFLICT (server_id,guild_id) DO UPDATE SET power=5000;
		INSERT INTO special_city_state(server_id,city_cfg_id,owner_guild_id) VALUES(1,1,95)
			ON CONFLICT (server_id,city_cfg_id) DO UPDATE SET owner_guild_id=95`); err != nil {
		t.Fatal(err)
	}
	src := newPGRankSource(pool)
	for _, tc := range []struct {
		typ  rank.RankType
		want int64
	}{
		{rank.RankPlayerPower, 900},
		{rank.RankPlayerPrestige, 777},
		{rank.RankHeroForce, 120},
		{rank.RankHeroIntel, 110},
		{rank.RankHeroPolitics, 100},
		{rank.RankHeroCommand, 90},
		{rank.RankGuildPower, 5000},
		{rank.RankSpecialCities, 1},
	} {
		rows, err := src.ListPlayerScores(ctx, 1, tc.typ)
		if err != nil {
			t.Fatalf("type %d: %v", tc.typ, err)
		}
		found := false
		for _, row := range rows {
			if row.PlayerID == 95 && row.Score == tc.want {
				found = true
			}
		}
		if !found {
			t.Fatalf("type %d missing player 95 score %d in %+v", tc.typ, tc.want, rows)
		}
	}
}
