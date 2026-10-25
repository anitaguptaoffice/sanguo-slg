package api

import (
	"context"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestHeroGatewayRecruitAndList(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 42}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Resources: map[string]int64{"food": 20000, "wood": 20000, "stone": 20000, "iron": 20000},
		Items:     []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 2}},
	}, "test:hero")
	if err != nil {
		t.Fatal(err)
	}

	heroSvc := hero.NewService()
	s := &Server{sessions: NewSessionRegistry(), contentSvc: contentSvc, heroSvc: heroSvc}
	s.sessions.Bind("sess-hero", PlayerContext{ServerID: 1, PlayerID: 42})

	recruitResp, err := s.handleRecruitHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-recruit", SessionId: "sess-hero", ServerId: 1,
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: 1001}),
	})
	if err != nil || recruitResp.Code != 0 {
		t.Fatalf("recruit: err=%v resp=%+v", err, recruitResp)
	}

	listResp, err := s.handleListPlayerHeroes(ctx, &commonv1.ClientPacket{
		TraceId: "t-list", SessionId: "sess-hero", ServerId: 1,
		Payload: mustProto(&herov1.ListPlayerHeroesRequest{ServerId: 1}),
	})
	if err != nil || listResp.Code != 0 {
		t.Fatalf("list: err=%v resp=%+v", err, listResp)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if len(listOut.GetHeroes()) != 1 || listOut.GetHeroes()[0].GetTemplateCfgId() != 1001 {
		t.Fatalf("list heroes=%v total=%d", listOut.GetHeroes(), listOut.GetTotalCount())
	}

	detailResp, err := s.handleGetHeroDetail(ctx, &commonv1.ClientPacket{
		TraceId: "t-detail", SessionId: "sess-hero", ServerId: 1,
		Payload: mustProto(&herov1.GetHeroDetailRequest{ServerId: 1, HeroId: listOut.GetHeroes()[0].GetHeroId()}),
	})
	if err != nil || detailResp.Code != 0 {
		t.Fatalf("detail: err=%v resp=%+v", err, detailResp)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		t.Fatal(err)
	}
	if detailOut.GetTemplateName() != "刘备" {
		t.Fatalf("detail name %q", detailOut.GetTemplateName())
	}
}

func TestHeroGatewayUpgradeHero(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 50}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Resources: map[string]int64{"food": 20000, "wood": 20000, "stone": 20000, "iron": 20000},
		Items:     []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 1}},
	}, "test:hero-upgrade")
	if err != nil {
		t.Fatal(err)
	}
	heroSvc := hero.NewService()
	s := &Server{sessions: NewSessionRegistry(), contentSvc: contentSvc, heroSvc: heroSvc}
	s.sessions.Bind("sess-up", PlayerContext{ServerID: 1, PlayerID: 50})

	recruitResp, err := s.handleRecruitHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-rec", SessionId: "sess-up", ServerId: 1,
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: 1001}),
	})
	if err != nil || recruitResp.Code != 0 {
		t.Fatalf("recruit: err=%v code=%d", err, recruitResp.Code)
	}
	var recruitOut herov1.RecruitHeroResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		t.Fatal(err)
	}
	hid := recruitOut.GetHeroId()
	h, _ := heroSvc.Store.GetHero(ctx, 1, hid)
	h.Exp = 200
	if err := heroSvc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}

	upResp, err := s.handleUpgradeHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-up", SessionId: "sess-up", ServerId: 1,
		Payload: mustProto(&herov1.UpgradeHeroRequest{ServerId: 1, HeroId: hid}),
	})
	if err != nil || upResp.Code != 0 {
		t.Fatalf("upgrade: err=%v code=%d msg=%s", err, upResp.Code, upResp.Msg)
	}
	var upOut herov1.UpgradeHeroResponse
	if err := proto.Unmarshal(upResp.Data, &upOut); err != nil {
		t.Fatal(err)
	}
	if upOut.GetLevel() != 2 || upOut.GetPreviousLevel() != 1 {
		t.Fatalf("upgrade out level=%d prev=%d", upOut.GetLevel(), upOut.GetPreviousLevel())
	}
}

func TestHeroGatewayListRecruitTemplates(t *testing.T) {
	ctx := context.Background()
	s := &Server{sessions: NewSessionRegistry(), heroSvc: hero.NewService()}
	s.sessions.Bind("sess-tpl", PlayerContext{ServerID: 1, PlayerID: 11})

	resp, err := s.handleListRecruitTemplates(ctx, &commonv1.ClientPacket{
		TraceId: "t-tpl", SessionId: "sess-tpl", ServerId: 1,
		Payload: mustProto(&herov1.ListRecruitTemplatesRequest{ServerId: 1, PageSize: 5}),
	})
	if err != nil || resp.Code != 0 {
		t.Fatalf("list templates: err=%v resp=%+v", err, resp)
	}
	var out herov1.ListRecruitTemplatesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		t.Fatal(err)
	}
	if out.GetTotalCount() < 20 || len(out.GetTemplates()) != 5 {
		t.Fatalf("total=%d len=%d", out.GetTotalCount(), len(out.GetTemplates()))
	}
	first := out.GetTemplates()[0]
	if first.GetRecruitCost().GetFood() != 5000 || first.GetRecruitItem().GetItemCfgId() != hero.RecruitScrollID {
		t.Fatalf("preview %+v", first)
	}
}

func TestHeroGatewaySetAndClearCityChief(t *testing.T) {
	ctx := context.Background()
	cityID := int64(501)
	heroSvc := hero.NewService()
	s := &Server{
		sessions: NewSessionRegistry(),
		heroSvc:  heroSvc,
		cities: map[int64]*domestic.CityState{
			cityID: {ID: cityID, PlayerID: 7},
		},
	}
	s.domestic = domestic.NewHub(nil)
	s.domestic.RegisterCity(s.cities[cityID])
	s.sessions.Bind("sess-chief", PlayerContext{ServerID: 1, PlayerID: 7})
	h := &hero.Hero{ServerID: 1, HeroID: 11, PlayerID: 7, TemplateCfgID: 1001, Status: hero.StatusIdle, Loyalty: 90}
	if err := heroSvc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}

	setResp, err := s.handleSetCityChief(ctx, &commonv1.ClientPacket{
		TraceId: "t-chief-set", SessionId: "sess-chief", ServerId: 1,
		Payload: mustProto(&herov1.SetCityChiefRequest{ServerId: 1, CityId: cityID, HeroId: 11}),
	})
	if err != nil || setResp.Code != 0 {
		t.Fatalf("set chief: err=%v resp=%+v", err, setResp)
	}
	var setOut herov1.SetCityChiefResponse
	if err := proto.Unmarshal(setResp.Data, &setOut); err != nil {
		t.Fatal(err)
	}
	if setOut.GetHeroId() != 11 || setOut.GetProductionBonus() <= 0 {
		t.Fatalf("set out %+v", &setOut)
	}

	getResp, err := s.handleGetCityChief(ctx, &commonv1.ClientPacket{
		TraceId: "t-chief-get", SessionId: "sess-chief", ServerId: 1,
		Payload: mustProto(&herov1.GetCityChiefRequest{ServerId: 1, CityId: cityID}),
	})
	if err != nil || getResp.Code != 0 {
		t.Fatalf("get chief: err=%v resp=%+v", err, getResp)
	}

	clearResp, err := s.handleClearCityChief(ctx, &commonv1.ClientPacket{
		TraceId: "t-chief-clear", SessionId: "sess-chief", ServerId: 1,
		Payload: mustProto(&herov1.ClearCityChiefRequest{ServerId: 1, CityId: cityID}),
	})
	if err != nil || clearResp.Code != 0 {
		t.Fatalf("clear chief: err=%v resp=%+v", err, clearResp)
	}
}

func TestHeroGatewayLargessGoldAndCooldown(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Resources: map[string]int64{
			"food": 20000, "wood": 20000, "stone": 20000, "iron": 20000, "gold": 50000,
		},
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 1}},
	}, "test:largess")
	if err != nil {
		t.Fatal(err)
	}
	heroSvc := hero.NewService()
	s := &Server{sessions: NewSessionRegistry(), contentSvc: contentSvc, heroSvc: heroSvc}
	s.sessions.Bind("sess-largess", PlayerContext{ServerID: 1, PlayerID: 55})

	recruitResp, err := s.handleRecruitHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-rec", SessionId: "sess-largess", ServerId: 1,
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: 1003}),
	})
	if err != nil || recruitResp.Code != 0 {
		t.Fatalf("recruit: err=%v resp=%+v", err, recruitResp)
	}
	var recruitOut herov1.RecruitHeroResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		t.Fatal(err)
	}
	heroID := recruitOut.GetHeroId()
	h, err := heroSvc.Store.GetHero(ctx, 1, heroID)
	if err != nil || h == nil {
		t.Fatal(err)
	}
	if err := heroSvc.SetHeroLoyalty(ctx, h, 25); err != nil {
		t.Fatal(err)
	}

	largessResp, err := s.handleLargessHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-largess", SessionId: "sess-largess", ServerId: 1,
		Payload: mustProto(&herov1.LargessHeroRequest{
			ServerId: 1, HeroId: heroID, GiftKind: herov1.LargessGiftKind_LARGESS_GIFT_GOLD,
		}),
	})
	if err != nil || largessResp.Code != 0 {
		t.Fatalf("largess: err=%v resp=%+v", err, largessResp)
	}
	var largessOut herov1.LargessHeroResponse
	if err := proto.Unmarshal(largessResp.Data, &largessOut); err != nil {
		t.Fatal(err)
	}
	if largessOut.GetLoyaltyDelta() < 1 || largessOut.GetGoldSpent() < 1 || largessOut.GetNextLargessAtMs() == 0 {
		t.Fatalf("largess delta=%d gold=%d next_ms=%d", largessOut.GetLoyaltyDelta(), largessOut.GetGoldSpent(), largessOut.GetNextLargessAtMs())
	}

	cdResp, err := s.handleLargessHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-largess-cd", SessionId: "sess-largess", ServerId: 1,
		Payload: mustProto(&herov1.LargessHeroRequest{
			ServerId: 1, HeroId: heroID, GiftKind: herov1.LargessGiftKind_LARGESS_GIFT_GOLD,
		}),
	})
	if err != nil || cdResp.Code == 0 {
		t.Fatalf("expected cooldown error, err=%v resp=%+v", err, cdResp)
	}
}

func TestHeroGatewayAddAndClearHeroPoint(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 61}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Resources: map[string]int64{"food": 20000, "wood": 20000, "stone": 20000, "iron": 20000},
		Items:     []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 1}},
	}, "test:hero-points")
	if err != nil {
		t.Fatal(err)
	}
	heroSvc := hero.NewService()
	s := &Server{sessions: NewSessionRegistry(), contentSvc: contentSvc, heroSvc: heroSvc}
	s.sessions.Bind("sess-points", PlayerContext{ServerID: 1, PlayerID: 61})

	recruitResp, err := s.handleRecruitHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-rec", SessionId: "sess-points", ServerId: 1,
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: 1001}),
	})
	if err != nil || recruitResp.Code != 0 {
		t.Fatalf("recruit: err=%v resp=%+v", err, recruitResp)
	}
	var recruitOut herov1.RecruitHeroResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		t.Fatal(err)
	}
	hid := recruitOut.GetHeroId()
	h, _ := heroSvc.Store.GetHero(ctx, 1, hid)
	h.Level = 3
	tpl := heroSvc.Catalog[h.TemplateCfgID]
	st := hero.StatsAtLevel(tpl, 3)
	hero.ApplyStatsForLevel(h, tpl, 3)
	if err := heroSvc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}

	addResp, err := s.handleAddHeroPoint(ctx, &commonv1.ClientPacket{
		TraceId: "t-add", SessionId: "sess-points", ServerId: 1,
		Payload: mustProto(&herov1.AddHeroPointRequest{
			ServerId: 1, HeroId: hid,
			Politics: st.Politics + 2, Force: st.Force + 1, Intel: st.Intel,
		}),
	})
	if err != nil || addResp.Code != 0 {
		t.Fatalf("add point: err=%v resp=%+v", err, addResp)
	}
	var addOut herov1.AddHeroPointResponse
	if err := proto.Unmarshal(addResp.Data, &addOut); err != nil {
		t.Fatal(err)
	}
	if addOut.GetPotentialRemaining() != 0 || addOut.GetPoliticsAdd() != 2 {
		t.Fatalf("add out rem=%d politics_add=%d", addOut.GetPotentialRemaining(), addOut.GetPoliticsAdd())
	}

	marchH, _ := heroSvc.Store.GetHero(ctx, 1, hid)
	marchH.Status = hero.StatusMarch
	if err := heroSvc.Store.SaveHero(ctx, marchH); err != nil {
		t.Fatal(err)
	}
	rejectResp, err := s.handleClearHeroPoint(ctx, &commonv1.ClientPacket{
		TraceId: "t-clear-busy", SessionId: "sess-points", ServerId: 1,
		Payload: mustProto(&herov1.ClearHeroPointRequest{ServerId: 1, HeroId: hid}),
	})
	if err != nil || rejectResp.Code == 0 {
		t.Fatalf("expected marching reject err=%v resp=%+v", err, rejectResp)
	}
	marchH.Status = hero.StatusIdle
	if err := heroSvc.Store.SaveHero(ctx, marchH); err != nil {
		t.Fatal(err)
	}

	clearResp, err := s.handleClearHeroPoint(ctx, &commonv1.ClientPacket{
		TraceId: "t-clear", SessionId: "sess-points", ServerId: 1,
		Payload: mustProto(&herov1.ClearHeroPointRequest{ServerId: 1, HeroId: hid}),
	})
	if err != nil || clearResp.Code != 0 {
		t.Fatalf("clear: err=%v resp=%+v", err, clearResp)
	}
	var clearOut herov1.ClearHeroPointResponse
	if err := proto.Unmarshal(clearResp.Data, &clearOut); err != nil {
		t.Fatal(err)
	}
	if clearOut.GetPotentialRemaining() != 3 || clearOut.GetPoliticsAdd() != 0 {
		t.Fatalf("clear out rem=%d politics_add=%d", clearOut.GetPotentialRemaining(), clearOut.GetPoliticsAdd())
	}
}

func TestHeroGatewayRecruitInsufficientItem(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 99}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Resources: map[string]int64{"food": 20000, "wood": 20000, "stone": 20000, "iron": 20000},
	}, "test:hero-poor")
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{sessions: NewSessionRegistry(), contentSvc: contentSvc, heroSvc: hero.NewService()}
	s.sessions.Bind("sess-poor", PlayerContext{ServerID: 1, PlayerID: 99})

	resp, err := s.handleRecruitHero(ctx, &commonv1.ClientPacket{
		TraceId: "t-poor", SessionId: "sess-poor", ServerId: 1,
		Payload: mustProto(&herov1.RecruitHeroRequest{ServerId: 1, TemplateCfgId: 1001}),
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Code == 0 {
		t.Fatal("expected error response")
	}
}
