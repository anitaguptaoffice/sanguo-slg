package api

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGWarViolationWindow(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES
			(95,'war95','x'),(96,'war96','x'),(97,'war97','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES
			(1,95,95,'攻方'),(1,96,96,'守方'),(1,97,97,'散人') ON CONFLICT DO NOTHING;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES
			(1,95,'攻盟',95,1),(1,96,'守盟',96,1) ON CONFLICT DO NOTHING;
		INSERT INTO guild_member(server_id,guild_id,player_id,role) VALUES
			(1,95,95,1),(1,96,96,1) ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES
			(1,95,95,'攻城',10,10),(1,96,96,'守城',11,11) ON CONFLICT DO NOTHING;
		DELETE FROM guild_relation WHERE server_id=1`); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 23, 8, 0, 0, 0, time.UTC)
	s := &Server{players: &PlayerStore{Pool: pool}, now: func() time.Time { return now }}
	pc := PlayerContext{ServerID: 1, PlayerID: 95}
	if reason, err := s.warViolation(ctx, pc, 11, 11, 1); err != nil || reason == "" {
		t.Fatalf("undeclared reason=%q err=%v", reason, err)
	}
	if reason, err := s.warViolation(ctx, pc, 11, 11, 2); err != nil || reason != "" {
		t.Fatalf("scout reason=%q err=%v", reason, err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO guild_relation(server_id,guild_id,target_guild_id,state,effective_at)
		VALUES(1,95,96,3,$1)`, now.Add(8*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if reason, err := s.warViolation(ctx, pc, 11, 11, 1); err != nil || reason == "" {
		t.Fatalf("pending reason=%q err=%v", reason, err)
	}
	now = now.Add(8*time.Hour + time.Second)
	if reason, err := s.warViolation(ctx, pc, 11, 11, 1); err != nil || reason != "" {
		t.Fatalf("active reason=%q err=%v", reason, err)
	}
	if reason, err := s.warViolation(ctx, PlayerContext{ServerID: 1, PlayerID: 97}, 11, 11, 1); err != nil || reason != "" {
		t.Fatalf("unguilded reason=%q err=%v", reason, err)
	}
}
