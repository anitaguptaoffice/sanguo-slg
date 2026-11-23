package api_test

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGMWorldPhaseSpecialCityAchievement(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(88,'gm88','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,88,88,'GM目标') ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,88,1,1,1,1,1)
			ON CONFLICT (server_id,player_id) DO NOTHING;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES(1,88,'GM盟',88,1)
			ON CONFLICT DO NOTHING;
		DELETE FROM world_phase_state WHERE server_id=1;
		DELETE FROM special_city_state WHERE server_id=1;
		DELETE FROM player_achievement WHERE server_id=1 AND player_id=88`); err != nil {
		t.Fatal(err)
	}
	gm := api.NewGmService(nil, pool, nil, nil)
	audit := api.GmAudit{OperatorID: "gm-bot", OperatorName: "bot", Reason: "gm world test", TicketID: "T-gm"}
	if _, phase, err := gm.WorldPhase(ctx, "", audit, 1); err != nil || phase.Phase != 1 || phase.Name != "讨平黄巾" {
		t.Fatalf("phase=%+v err=%v", phase, err)
	}
	op, phase, err := gm.SetWorldPhase(ctx, "", audit, 1, 2)
	if err != nil || phase.Phase != 2 || phase.Name != "群雄割据" || op.AuditLogID == "" {
		t.Fatalf("set phase=%+v op=%+v err=%v", phase, op, err)
	}
	_, cities, err := gm.ListSpecialCities(ctx, "", audit, 1)
	if err != nil || len(cities) != 9 {
		t.Fatalf("cities len=%d err=%v", len(cities), err)
	}
	_, city, err := gm.SetSpecialCityOwner(ctx, "", audit, 1, 8, 88)
	if err != nil || city.OwnerGuildID != 88 || city.OwnerGuildName != "GM盟" || city.Garrison != 22000 {
		t.Fatalf("owner city=%+v err=%v", city, err)
	}
	_, rows, err := gm.ListAchievements(ctx, "", audit, 1, 88)
	if err != nil || len(rows) != 10 {
		t.Fatalf("achievements=%d err=%v", len(rows), err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO player_achievement(server_id,player_id,achievement_id) VALUES(1,88,1)`); err != nil {
		t.Fatal(err)
	}
	_, reset, err := gm.ResetAchievement(ctx, "", audit, 1, 88, 1)
	if err != nil || !reset {
		t.Fatalf("reset=%v err=%v", reset, err)
	}
}
