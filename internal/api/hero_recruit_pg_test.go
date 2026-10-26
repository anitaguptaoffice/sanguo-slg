package api

import (
	"context"
	"fmt"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

type recruitAssets struct {
	Wallet        hero.Resources
	Books, Heroes int
}

func recruitSQL(t *testing.T, pool *pgxpool.Pool, q string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), q, args...); err != nil {
		t.Fatal(err)
	}
}

func recruitServer(t *testing.T, pool *pgxpool.Pool, playerID int64) *Server {
	t.Helper()
	s := NewServer(nil, pool, nil, nil, nil)
	if err := s.WireM4Content(context.Background()); err != nil {
		t.Fatal(err)
	}
	s.sessions.Bind("recruit", PlayerContext{ServerID: 1, PlayerID: playerID})
	return s
}

func seedRecruitActor(t *testing.T, pool *pgxpool.Pool, id int64, wallet hero.Resources, books int) {
	t.Helper()
	var accountID int64
	err := pool.QueryRow(context.Background(), `INSERT INTO account(login_name,password_hash) VALUES($1,'fixture') RETURNING account_id`, fmt.Sprintf("recruit-%d", id)).Scan(&accountID)
	if err != nil {
		t.Fatal(err)
	}
	recruitSQL(t, pool, `INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,$1,$2,'recruit')`, id, accountID)
	recruitSQL(t, pool, `INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,$1,$2,$3,$4,$5,$6)`, id, wallet.Food, wallet.Wood, wallet.Stone, wallet.Iron, wallet.Gold)
	recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,$1,2004,$2)`, id, books)
}

func readRecruitAssets(t *testing.T, pool *pgxpool.Pool, id int64) recruitAssets {
	t.Helper()
	var a recruitAssets
	err := pool.QueryRow(context.Background(), `SELECT food,wood,stone,iron,gold,
  COALESCE((SELECT quantity FROM player_item WHERE server_id=1 AND player_id=$1 AND item_cfg_id=2004),0),
  (SELECT count(*) FROM player_hero WHERE server_id=1 AND player_id=$1)
  FROM player_wallet WHERE server_id=1 AND player_id=$1`, id).Scan(&a.Wallet.Food, &a.Wallet.Wood, &a.Wallet.Stone, &a.Wallet.Iron, &a.Wallet.Gold, &a.Books, &a.Heroes)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func recruitPacket(template int32) *commonv1.ClientPacket {
	return &commonv1.ClientPacket{Route: RouteRecruitHero, SessionId: "recruit", ServerId: 1, TraceId: "atomic-recruit",
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: template})}
}

func recruitReply(t *testing.T, resp *commonv1.ServerPacket) *herov1.RecruitHeroResponse {
	t.Helper()
	if resp.Code != 0 {
		t.Fatalf("recruit response: %+v", resp)
	}
	var out herov1.RecruitHeroResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		t.Fatal(err)
	}
	return &out
}

func TestRecruitAtomicPGExactCostAndRestart(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 12345}, 2)
	s := recruitServer(t, pool, 7)
	before := readRecruitAssets(t, pool, 7)
	out := recruitReply(t, s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001)))
	after := readRecruitAssets(t, pool, 7)
	want := before
	tpl := s.heroSvc.Catalog[1001]
	if !want.Wallet.Sub(tpl.RecruitCost) {
		t.Fatal("fixture budget")
	}
	want.Books -= int(tpl.RecruitItem.Quantity)
	want.Heroes++
	if after != want {
		t.Fatalf("assets: got %+v want %+v", after, want)
	}
	restarted := recruitServer(t, pool, 7)
	h, err := restarted.heroSvc.Store.GetHero(context.Background(), 1, out.HeroId)
	if err != nil || h.HeroID <= 0 || h.PlayerID != 7 || h.TemplateCfgID != 1001 || h.Level != 1 || h.Loyalty != hero.LoyaltyDefault || h.Status != hero.StatusIdle ||
		h.Force != tpl.Base.Force || h.Intel != tpl.Base.Intel || h.Politics != tpl.Base.Politics || h.Command != tpl.Base.Command || out.Level != h.Level || int(out.Loyalty) != h.Loyalty {
		t.Fatalf("durable hero: %+v %v", h, err)
	}
	if err := restarted.contentSvc.LoadPlayer(context.Background(), content.PlayerRef{ServerID: 1, PlayerID: 7}); err != nil {
		t.Fatal(err)
	}
	if got := restarted.contentSvc.List(content.PlayerRef{ServerID: 1, PlayerID: 7}); len(got) != 1 || got[0].Quantity != int32(want.Books) {
		t.Fatalf("restart bag: %+v", got)
	}
}

func TestRecruitAtomicPGRejectsWithoutMutation(t *testing.T) {
	for _, kind := range []string{"resources", "books", "unknown", "unknown-item", "wrong-shard", "missing-actor", "wrong-account", "negative-actor", "missing-wallet", "missing-content", "missing-hero", "missing-ports", "wrong-pool"} {
		t.Run(kind, func(t *testing.T) {
			pool := walletBoundaryPool(t, true)
			seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 123}, 2)
			s := recruitServer(t, pool, 7)
			pkt := recruitPacket(1001)
			switch kind {
			case "resources":
				recruitSQL(t, pool, `UPDATE player_wallet SET wood=0`)
			case "books":
				recruitSQL(t, pool, `UPDATE player_item SET quantity=0`)
			case "unknown":
				pkt = recruitPacket(999999)
			case "unknown-item":
				pkt.Payload = mustProto(&herov1.RecruitHeroRequest{ItemCfgId: 999999})
			case "wrong-shard":
				pkt.ServerId = 2
			case "missing-actor":
				recruitSQL(t, pool, `DELETE FROM player`)
			case "wrong-account":
				s.sessions.Bind("recruit", PlayerContext{ServerID: 1, PlayerID: 7, AccountID: 99999})
			case "negative-actor":
				s.sessions.Bind("recruit", PlayerContext{ServerID: 1, PlayerID: -7})
			case "missing-wallet":
				recruitSQL(t, pool, `DELETE FROM player_wallet`)
			case "missing-content":
				s.contentSvc = nil
			case "missing-hero":
				s.heroSvc = nil
			case "missing-ports":
				s.recruit = nil
			case "wrong-pool":
				s.recruit.heroes.Pool = walletBoundaryPool(t, true)
			}
			if kind == "missing-wallet" {
				resp := s.GatewayRouter().Dispatch(context.Background(), pkt)
				var n int
				if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM player_wallet`).Scan(&n); err != nil || n != 0 || resp.Code == 0 {
					t.Fatalf("missing wallet: %+v n=%d %v", resp, n, err)
				}
				return
			}
			before := readRecruitAssets(t, pool, 7)
			resp := s.GatewayRouter().Dispatch(context.Background(), pkt)
			if resp.Code == 0 {
				t.Fatalf("unexpected success: %+v", resp)
			}
			if after := readRecruitAssets(t, pool, 7); after != before {
				t.Fatalf("partial mutation: %+v -> %+v", before, after)
			}
		})
	}
}

func TestRecruitAtomicPGSQLFailuresRollbackAllAssets(t *testing.T) {
	for _, stage := range []string{"after-wallet", "after-item", "after-insert", "before-commit"} {
		t.Run(stage, func(t *testing.T) {
			pool := walletBoundaryPool(t, true)
			seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 321}, 2)
			s := recruitServer(t, pool, 7)
			recruitSQL(t, pool, `CREATE FUNCTION fail_recruit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private injected SQL failure'; END $$`)
			sql := map[string]string{
				"after-wallet":  `CREATE TRIGGER fail_recruit BEFORE UPDATE ON player_item FOR EACH ROW EXECUTE FUNCTION fail_recruit()`,
				"after-item":    `CREATE TRIGGER fail_recruit BEFORE INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_recruit()`,
				"after-insert":  `CREATE TRIGGER fail_recruit AFTER INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_recruit()`,
				"before-commit": `CREATE CONSTRAINT TRIGGER fail_recruit AFTER INSERT ON player_hero DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_recruit()`,
			}[stage]
			recruitSQL(t, pool, sql)
			before := readRecruitAssets(t, pool, 7)
			resp := s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
			if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || resp.Msg != "recruit outcome unavailable; refresh hero and inventory state" {
				t.Fatalf("failure response: %+v", resp)
			}
			if after := readRecruitAssets(t, pool, 7); after != before {
				t.Fatalf("partial mutation: %+v -> %+v", before, after)
			}
			var signals int
			if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM player_quest WHERE player_id=7`).Scan(&signals); err != nil || signals != 0 {
				t.Fatalf("precommit quest publication: %d %v", signals, err)
			}
		})
	}
}
