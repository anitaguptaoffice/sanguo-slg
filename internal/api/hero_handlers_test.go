package api

import (
	"context"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
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
