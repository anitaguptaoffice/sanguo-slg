package api

import (
	"context"
	"errors"
	"strings"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestRecruitRequiresAtomicDependencies(t *testing.T) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{sessions: NewSessionRegistry(), heroSvc: hero.NewService(), contentSvc: content.NewService(cat)}
	p := content.PlayerRef{ServerID: 1, PlayerID: 7}
	_, err = s.contentSvc.Grant(p, content.RewardPackage{Resources: map[string]int64{"food": 50000, "wood": 50000, "stone": 50000, "iron": 50000}, Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 2}}}, "fixture")
	if err != nil {
		t.Fatal(err)
	}
	s.sessions.Bind("actor", PlayerContext{ServerID: 1, PlayerID: 7})
	resp, err := s.handleRecruitHero(context.Background(), &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&herov1.RecruitHeroRequest{TemplateCfgId: 1001})})
	if err != nil || resp.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatalf("unwired: %+v %v", resp, err)
	}
	heroes, err := s.heroSvc.Store.ListPlayerHeroes(context.Background(), 1, 7)
	if err != nil || len(heroes) != 0 || s.contentSvc.List(p)[0].Quantity != 2 {
		t.Fatalf("unwired mutation: %v %v", heroes, err)
	}
}

func TestRecruitErrorsDoNotExposeSQL(t *testing.T) {
	s := &Server{}
	resp := s.recruitError("trace", errors.New("SQL secret constraint detail"))
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || strings.Contains(resp.Msg, "SQL") || strings.Contains(resp.Msg, "rollback") {
		t.Fatalf("unsafe error %+v", resp)
	}
	for _, err := range []error{hero.ErrAlreadyOwned, hero.ErrInsufficientRes, hero.ErrInsufficientItem, hero.ErrUnknownTemplate} {
		if got := s.recruitError("trace", err); got.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || got.Msg != err.Error() {
			t.Fatalf("business error changed: %+v", got)
		}
	}
}
