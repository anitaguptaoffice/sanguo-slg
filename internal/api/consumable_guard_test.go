package api

import (
	"context"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strings"
	"testing"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func guardedConsumablePacket(item, count int32) *commonv1.ClientPacket {
	return &commonv1.ClientPacket{Route: RouteUseConsumable, SessionId: "owner", ServerId: 1, TraceId: "guard",
		Payload: mustProto(&contentv1.UseConsumableRequest{ServerId: 1, ItemCfgId: item, Count: count})}
}

func assertConsumableRejected(t *testing.T, out *commonv1.ServerPacket, phrase string) {
	t.Helper()
	if out == nil || out.Code == 0 || len(out.Data) != 0 || !strings.Contains(out.Msg, phrase) || strings.Contains(out.Msg, "占位") {
		t.Fatalf("expected non-success without a placeholder payload: %+v", out)
	}
}

func consumableGuardRows(t *testing.T, pool *pgxpool.Pool) map[string]string {
	t.Helper()
	out := scopeRows(t, pool)
	for _, table := range []string{"player_city", "city_troop", "army_troop", "field_army", "march_order"} {
		var rows string
		if err := pool.QueryRow(context.Background(), `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text FROM `+table+` t`).Scan(&rows); err != nil {
			t.Fatal(err)
		}
		out[table] = rows
	}
	return out
}

func TestConsumableGuardPGAllUnappliedTypesBeforeHydration(t *testing.T) {
	s, pool := scopeServer(t)
	if err := s.WireM4Content(context.Background()); err != nil {
		t.Fatal(err)
	}
	cat := s.contentCatalog.catalog // The actual WireM4Content catalog, not a second default catalog.
	var ids []int32
	for id, def := range cat.Items {
		if def.Type == content.ItemTypeRecruit || def.Type == content.ItemTypeTrainTroop {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	t.Logf("default guarded item IDs: %v", ids)
	if len(ids) != 11 {
		t.Fatalf("review catalog coverage: %v", ids)
	}
	// Test-only aliases prove type-based classification, not a hardcoded ID denylist.
	for _, original := range []int32{2004, 2005} {
		def := cat.Items[original]
		def.ID += 90000
		cat.Items[def.ID] = def
		ids = append(ids, def.ID)
	}
	for _, id := range ids {
		recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,55,$1,3)`, id)
	}
	recruitSQL(t, pool, `INSERT INTO city_troop(server_id,city_id,unit_cfg_id,count,wounded) VALUES(1,7,1,17,2)`)
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	before, bag, wallet := consumableGuardRows(t, pool), s.contentSvc.List(p), s.contentSvc.Wallet(p)
	city, military := s.citySnapshot(7), s.military.SnapshotCity(7)
	for _, id := range ids {
		for _, count := range []int32{math.MinInt32, -1, 0, 1, 2, 3, 4, math.MaxInt32} {
			t.Run(fmt.Sprintf("%d/count_%d", id, count), func(t *testing.T) {
				out := s.GatewayRouter().Dispatch(context.Background(), guardedConsumablePacket(id, count))
				assertConsumableRejected(t, out, "未扣除道具")
				if cat.Items[id].Type == content.ItemTypeRecruit && !strings.Contains(out.Msg, "将领招募入口") {
					t.Fatalf("missing supported recruit route guidance: %s", out.Msg)
				}
				if !reflect.DeepEqual(before, consumableGuardRows(t, pool)) || !reflect.DeepEqual(bag, s.contentSvc.List(p)) || wallet != s.contentSvc.Wallet(p) ||
					!reflect.DeepEqual(city, s.citySnapshot(7)) || !reflect.DeepEqual(military, s.military.SnapshotCity(7)) {
					t.Fatal("rejected use hydrated or mutated bag, wallet, hero, troop, quest, queue or city state")
				}
			})
		}
	}
	// A hydrated cache must remain unchanged as well.
	if err := s.contentSvc.LoadPlayer(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	bag, wallet = s.contentSvc.List(p), s.contentSvc.Wallet(p)
	assertConsumableRejected(t, s.GatewayRouter().Dispatch(context.Background(), guardedConsumablePacket(2004, 1)), "未扣除道具")
	if !reflect.DeepEqual(before, consumableGuardRows(t, pool)) || !reflect.DeepEqual(bag, s.contentSvc.List(p)) || wallet != s.contentSvc.Wallet(p) {
		t.Fatal("hydrated rejection changed assets")
	}
}

func TestConsumableGuardPGRejectsUntrustedWiring(t *testing.T) {
	for _, mode := range []string{"unbound", "nil-catalog", "rewired", "unknown-item", "unknown-type"} {
		t.Run(mode, func(t *testing.T) {
			s, pool := scopeServer(t)
			if err := s.WireM4Content(context.Background()); err != nil {
				t.Fatal(err)
			}
			item, phrase := int32(2001), "未扣除道具"
			switch mode {
			case "unbound":
				s.contentCatalog = nil
			case "nil-catalog":
				s.contentCatalog.catalog = nil
			case "rewired":
				cat, err := content.EmbeddedCatalog()
				if err != nil {
					t.Fatal(err)
				}
				def := cat.Items[2004]
				def.ID = item
				cat.Items[item] = def
				s.contentSvc = content.NewService(cat)
				s.contentSvc.UseStore(content.NewPGStore(pool))
			case "unknown-item":
				item, phrase = 999999, "unknown item"
			case "unknown-type":
				def := s.contentCatalog.catalog.Items[item]
				def.Type = 999
				s.contentCatalog.catalog.Items[item] = def
				phrase = content.ErrNotConsumable.Error()
			}
			p := content.PlayerRef{ServerID: 1, PlayerID: 55}
			before, bag, wallet := consumableGuardRows(t, pool), s.contentSvc.List(p), s.contentSvc.Wallet(p)
			assertConsumableRejected(t, s.GatewayRouter().Dispatch(context.Background(), guardedConsumablePacket(item, 1)), phrase)
			if !reflect.DeepEqual(before, consumableGuardRows(t, pool)) || !reflect.DeepEqual(bag, s.contentSvc.List(p)) || wallet != s.contentSvc.Wallet(p) {
				t.Fatal("untrusted wiring hydrated or mutated assets")
			}
		})
	}
}

func TestConsumableGuardMemoryFixturesRequireBinding(t *testing.T) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{sessions: NewSessionRegistry(), contentSvc: content.NewService(cat)}
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	for _, item := range []int32{2001, 2004, 2005} {
		if _, err := s.contentSvc.Add(p, item, 2); err != nil {
			t.Fatal(err)
		}
	}
	before, wallet := s.contentSvc.List(p), s.contentSvc.Wallet(p)
	for _, bound := range []bool{false, true} {
		if bound {
			s.contentCatalog = &contentCatalogBinding{service: s.contentSvc, catalog: cat}
		}
		for _, item := range []int32{2004, 2005} {
			out, err := s.handleUseConsumable(context.Background(), guardedConsumablePacket(item, 1))
			if err != nil {
				t.Fatal(err)
			}
			assertConsumableRejected(t, out, "未扣除道具")
		}
		if !bound {
			out, err := s.handleUseConsumable(context.Background(), guardedConsumablePacket(2001, 1))
			if err != nil {
				t.Fatal(err)
			}
			assertConsumableRejected(t, out, "未扣除道具")
		}
	}
	if !reflect.DeepEqual(before, s.contentSvc.List(p)) || wallet != s.contentSvc.Wallet(p) {
		t.Fatal("memory fixture bypassed pre-debit guard")
	}
	out, err := s.handleUseConsumable(context.Background(), guardedConsumablePacket(2001, 1))
	if err != nil || out.Code != 0 || s.contentSvc.Wallet(p).Food != 1000 {
		t.Fatalf("explicitly bound resource fixture regressed: %+v %v", out, err)
	}
}

func TestConsumableGuardPGSupportedEffectsRemainApplied(t *testing.T) {
	for speedup, seconds := range map[int32]int64{2003: 300, 2011: 900, 2035: 1800, 2036: 3600} {
		t.Run(fmt.Sprint(speedup), func(t *testing.T) {
			s, pool := scopeServer(t)
			if err := s.WireM4Content(context.Background()); err != nil {
				t.Fatal(err)
			}
			recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,55,2001,3),(1,55,$1,3) ON CONFLICT DO NOTHING`, speedup)
			if _, err := s.domestic.StartBuildingUpgrade(7, "farm", 2); err != nil {
				t.Fatal(err)
			}
			var food int64
			if err := pool.QueryRow(context.Background(), `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=55`).Scan(&food); err != nil {
				t.Fatal(err)
			}
			beforeFinish := s.citySnapshot(7).BuildJobs[0].FinishAt
			for _, item := range []int32{2001, speedup} {
				out := s.GatewayRouter().Dispatch(context.Background(), guardedConsumablePacket(item, 1))
				var effect contentv1.UseConsumableResponse
				if out.Code != 0 || proto.Unmarshal(out.Data, &effect) != nil || effect.Remaining != 2 || effect.EffectSummary == "" || strings.Contains(effect.EffectSummary, "占位") {
					t.Fatalf("supported effect %d: %+v %+v", item, out, &effect)
				}
				var remaining int32
				if err := pool.QueryRow(context.Background(), `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=55 AND item_cfg_id=$1`, item).Scan(&remaining); err != nil || remaining != 2 {
					t.Fatalf("supported item %d durable remaining=%d: %v", item, remaining, err)
				}
				if item == 2001 && effect.GetWalletAfter().GetFood() != food+1000 || item == speedup && effect.SpeedupSeconds != seconds {
					t.Fatalf("supported effect missing: %+v", &effect)
				}
			}
			var afterFood int64
			if err := pool.QueryRow(context.Background(), `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=55`).Scan(&afterFood); err != nil || afterFood != food+1000 {
				t.Fatalf("resource pack durable food=%d want=%d: %v", afterFood, food+1000, err)
			}
			afterFinish := s.citySnapshot(7).BuildJobs[0].FinishAt
			if !afterFinish.Before(beforeFinish) {
				t.Fatalf("build effect not applied: before=%v after=%v", beforeFinish, afterFinish)
			}
			var level, queues int
			if err := pool.QueryRow(context.Background(), `SELECT level, (SELECT count(*) FROM work_queue WHERE server_id=1 AND city_id=7 AND queue_type=1) FROM city_building WHERE server_id=1 AND city_id=7 AND slot_key='farm'`).Scan(&level, &queues); err != nil || level != 2 || queues != 0 {
				t.Fatalf("completed build not durable: level=%d queues=%d: %v", level, queues, err)
			}
		})
	}
}

func TestConsumableGuardPGSpeedupRequiresBuildConsumer(t *testing.T) {
	s, pool := scopeServer(t)
	if err := s.WireM4Content(context.Background()); err != nil {
		t.Fatal(err)
	}
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	before, bag, wallet := consumableGuardRows(t, pool), s.contentSvc.List(p), s.contentSvc.Wallet(p)
	cat := s.contentCatalog.catalog
	for name, targets := range map[string]any{
		"research-only": []any{"research"}, "train-only": []any{"train"}, "march-only": []any{"march"},
		"missing": nil, "empty": []any{}, "malformed": []string{"build"},
		"mixed-after-build": []any{"build", float64(7)}, "mixed-before-build": []any{false, "build"},
		"mixed-null": []any{"build", nil},
	} {
		t.Run(name, func(t *testing.T) {
			def := cat.Items[2003]
			def.Meta["applies_to"] = targets
			cat.Items[2003] = def
			for _, count := range []int32{0, 1, math.MaxInt32} {
				assertConsumableRejected(t, s.GatewayRouter().Dispatch(context.Background(), guardedConsumablePacket(2003, count)), "未扣除道具")
			}
			if !reflect.DeepEqual(before, consumableGuardRows(t, pool)) || !reflect.DeepEqual(bag, s.contentSvc.List(p)) || wallet != s.contentSvc.Wallet(p) {
				t.Fatal("speedup without a build consumer hydrated or mutated assets")
			}
		})
	}
}
