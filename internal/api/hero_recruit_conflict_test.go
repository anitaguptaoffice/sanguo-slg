package api

import (
	"context"
	"strconv"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func TestRecruitAtomicPGConcurrentTemplateConstraint(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 17}, 2)
	s := recruitServer(t, pool, 7)
	competitor := &hero.Hero{ServerID: 1, PlayerID: 7, TemplateCfgID: 1001, Level: 1, Loyalty: 100, Status: hero.StatusComing}
	before := readRecruitAssets(t, pool, 7)
	// A different approved creator need not take the recruitment wallet lock. Its
	// committed insert occurs after our plan; the unique constraint is the arbiter.
	s.recruit.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		tx, err := pool.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		return &recruitObservedTx{Tx: tx, afterRow: func(q string) {
			if strings.Contains(q, "UPDATE player_item") {
				if err := s.recruit.heroes.CreateHero(context.Background(), competitor); err != nil {
					t.Fatal(err)
				}
			}
		}}, nil
	}
	resp := s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || resp.Msg != hero.ErrAlreadyOwned.Error() {
		t.Fatalf("template conflict: %+v", resp)
	}
	want := before
	want.Heroes++ // Only the independently committed competitor exists.
	if after := readRecruitAssets(t, pool, 7); after != want {
		t.Fatalf("constraint partial spend: %+v want %+v", after, want)
	}
	saved, err := s.heroSvc.Store.GetHero(context.Background(), 1, competitor.HeroID)
	if err != nil || saved.Status != hero.StatusComing {
		t.Fatalf("competitor overwritten: %+v %v", saved, err)
	}
}

func TestRecruitAtomicPGIdentityCollisionIsNotTemplateRejection(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 17}, 2)
	s := recruitServer(t, pool, 7)
	original := &hero.Hero{ServerID: 1, PlayerID: 99, TemplateCfgID: 1002, Level: 7, Loyalty: 33, Status: hero.StatusGarrison}
	if err := s.recruit.heroes.CreateHero(context.Background(), original); err != nil {
		t.Fatal(err)
	}
	// A trigger injects a corrupt allocator result without rewinding the sequence.
	recruitSQL(t, pool, `CREATE FUNCTION collide_recruit_identity() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.hero_id := `+strconv.FormatInt(original.HeroID, 10)+`; RETURN NEW; END $$;
  CREATE TRIGGER collide_recruit_identity BEFORE INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION collide_recruit_identity()`)
	before := readRecruitAssets(t, pool, 7)
	resp := s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || strings.Contains(resp.Msg, hero.ErrAlreadyOwned.Error()) {
		t.Fatalf("identity collision swallowed: %+v", resp)
	}
	if after := readRecruitAssets(t, pool, 7); after != before {
		t.Fatalf("identity partial spend: %+v -> %+v", before, after)
	}
	saved, err := s.heroSvc.Store.GetHero(context.Background(), 1, original.HeroID)
	if err != nil || saved.PlayerID != original.PlayerID || saved.TemplateCfgID != original.TemplateCfgID || saved.Level != 7 || saved.Loyalty != 33 || saved.Status != hero.StatusGarrison {
		t.Fatalf("identity overwritten: %+v %v", saved, err)
	}
}
