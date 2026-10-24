package hero

import (
	"context"
	"testing"
	"time"
)

func TestBeginExprSetsStatusAndTimer(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	h := &Hero{ServerID: 1, HeroID: 3, PlayerID: 9, Level: 5, Status: StatusIdle}
	res, sess, err := BeginExprOnce(h, 2, now, 10_000)
	if err != nil {
		t.Fatal(err)
	}
	if h.Status != StatusExpr || res.GoldSpent != ExprGoldCost(5, 2) {
		t.Fatalf("status=%d gold=%d", h.Status, res.GoldSpent)
	}
	wantEnd := now.Add(2 * time.Duration(ExprSecondsPerHour) * time.Second)
	if !sess.EndsAt.Equal(wantEnd) || sess.Hours != 2 {
		t.Fatalf("ends=%v hours=%d", sess.EndsAt, sess.Hours)
	}
}

func TestBeginExprRejectsNotIdle(t *testing.T) {
	h := &Hero{HeroID: 1, Level: 1, Status: StatusMarch}
	_, _, err := BeginExprOnce(h, 1, time.Now(), 999)
	if err != ErrHeroNotIdle {
		t.Fatalf("got %v", err)
	}
}

func TestCancelAndFinishExprFlow(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()
	h := &Hero{ServerID: 1, HeroID: 8, PlayerID: 2, Level: 3, Status: StatusIdle, Exp: 10}
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	svc := NewService()
	svc.UseStore(store)
	start := time.Unix(1_800_000_000, 0)
	svc.SetClock(func() time.Time { return start })

	inv := &exprTestInventory{gold: 500}
	begin, err := svc.BeginExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 2}, inv, 8, 1)
	if err != nil {
		t.Fatal(err)
	}
	if begin.Hero.Status != StatusExpr {
		t.Fatalf("status=%d", begin.Hero.Status)
	}

	_, err = svc.FinishExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 2}, 8)
	if err != ErrExprNotComplete {
		t.Fatalf("early finish: %v", err)
	}

	h2, err := svc.CancelExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 2}, 8)
	if err != nil || h2.Status != StatusIdle {
		t.Fatalf("cancel: hero=%v err=%v", h2, err)
	}

	_, err = svc.BeginExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 2}, inv, 8, 1)
	if err != nil {
		t.Fatal(err)
	}
	svc.SetClock(func() time.Time { return start.Add(time.Duration(ExprSecondsPerHour) * time.Second) })
	fin, err := svc.FinishExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 2}, 8)
	if err != nil {
		t.Fatal(err)
	}
	wantExp := 10 + ExprRewardExp(3, 1)
	if fin.Hero.Exp != wantExp || fin.ExpGained != ExprRewardExp(3, 1) {
		t.Fatalf("exp=%d gain=%d", fin.Hero.Exp, fin.ExpGained)
	}
	if fin.Hero.Status != StatusIdle {
		t.Fatalf("status=%d", fin.Hero.Status)
	}
}

func TestFasterExprCompletesEarly(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()
	h := &Hero{ServerID: 1, HeroID: 4, PlayerID: 1, Level: 2, Status: StatusIdle}
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	svc := NewService()
	svc.UseStore(store)
	now := time.Unix(1_900_000_000, 0)
	svc.SetClock(func() time.Time { return now })
	inv := &exprTestInventory{gold: 1000}
	if _, err := svc.BeginExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 1}, inv, 4, 1); err != nil {
		t.Fatal(err)
	}
	res, err := svc.FasterExprPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 1}, 4)
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.Status != StatusIdle || res.ExpGained != ExprRewardExp(2, 1) {
		t.Fatalf("status=%d gain=%d", res.Hero.Status, res.ExpGained)
	}
}

func TestFinishRejectsWhenNotExpr(t *testing.T) {
	h := &Hero{HeroID: 1, Status: StatusIdle}
	_, err := FinishExprOnce(h, &ExprSession{HeroID: 1}, time.Now(), false)
	if err != ErrHeroNotExpr {
		t.Fatalf("got %v", err)
	}
}

type exprTestInventory struct{ gold int64 }

func (e *exprTestInventory) LoadWalletAndItems(context.Context, PlayerRef) (Resources, map[int32]int32, error) {
	return Resources{Gold: e.gold}, map[int32]int32{}, nil
}
func (e *exprTestInventory) ApplyRecruitSpend(context.Context, PlayerRef, Resources, map[int32]int32, Resources, map[int32]int32) error {
	return nil
}
func (e *exprTestInventory) ApplyLargessSpend(_ context.Context, _ PlayerRef, gold int64, _ int32) error {
	if e.gold < gold {
		return ErrInsufficientGold
	}
	e.gold -= gold
	return nil
}
func (e *exprTestInventory) SpendItemQty(context.Context, PlayerRef, int32, int32) error { return nil }
