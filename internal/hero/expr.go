package hero

import (
	"context"
	"errors"
	"time"
)

// M1 历练时长与奖励（legacy beginExprHero / finishHeroExpr 简化；见 spec/rules/legacy_alignment.md §7）。
const (
	ExprHoursDefault  int32 = 1
	ExprHoursMin      int32 = 1
	ExprHoursMax      int32 = 4
	ExprSecondsPerHour      = 3600
	exprGoldPerLevelHour    = 10
	exprExpPerLevelHour     = 20
)

// ExprSession is an in-progress hero training run (legacy sys_hero_expr).
type ExprSession struct {
	ServerID  int32
	HeroID    int64
	StartedAt time.Time
	EndsAt    time.Time
	Hours     int32
}

// ExprBeginResult is returned when training starts.
type ExprBeginResult struct {
	Hero      *Hero
	Session   ExprSession
	GoldSpent int64
}

// ExprFinishResult is returned when training completes (natural or accelerated).
type ExprFinishResult struct {
	Hero     *Hero
	ExpGained int64
}

// ExprGoldCost is the wallet gold to start training for level×hours (M1 delta: player wallet only).
func ExprGoldCost(level, hours int32) int64 {
	return int64(level) * int64(hours) * int64(exprGoldPerLevelHour)
}

// ExprRewardExp is exp granted on finish (M1: no random events / carry money).
func ExprRewardExp(level, hours int32) int64 {
	return int64(level) * int64(hours) * int64(exprExpPerLevelHour)
}

func normalizeExprHours(hours int32) (int32, error) {
	if hours == 0 {
		hours = ExprHoursDefault
	}
	if hours < ExprHoursMin || hours > ExprHoursMax {
		return 0, ErrInvalidExprHours
	}
	return hours, nil
}

// BeginExprOnce starts training on an idle owned hero (in-memory).
func BeginExprOnce(h *Hero, hours int32, now time.Time, walletGold int64) (ExprBeginResult, ExprSession, error) {
	hours, err := normalizeExprHours(hours)
	if err != nil {
		return ExprBeginResult{}, ExprSession{}, err
	}
	if h.Status != StatusIdle {
		return ExprBeginResult{}, ExprSession{}, ErrHeroNotIdle
	}
	cost := ExprGoldCost(h.Level, hours)
	if walletGold < cost {
		return ExprBeginResult{}, ExprSession{}, ErrInsufficientGold
	}
	ends := now.Add(time.Duration(hours) * time.Duration(ExprSecondsPerHour) * time.Second)
	sess := ExprSession{
		ServerID: h.ServerID, HeroID: h.HeroID,
		StartedAt: now, EndsAt: ends, Hours: hours,
	}
	h.Status = StatusExpr
	return ExprBeginResult{Hero: h, Session: sess, GoldSpent: cost}, sess, nil
}

// CancelExprOnce aborts training and restores idle (M1 delta: no partial exp).
func CancelExprOnce(h *Hero, sess *ExprSession) error {
	if h.Status != StatusExpr {
		return ErrHeroNotExpr
	}
	if sess == nil || sess.HeroID != h.HeroID {
		return ErrExprNotFound
	}
	h.Status = StatusIdle
	return nil
}

// FinishExprOnce completes training when the timer has elapsed (or when allowEarly).
func FinishExprOnce(h *Hero, sess *ExprSession, now time.Time, allowEarly bool) (ExprFinishResult, error) {
	if h.Status != StatusExpr {
		return ExprFinishResult{}, ErrHeroNotExpr
	}
	if sess == nil || sess.HeroID != h.HeroID {
		return ExprFinishResult{}, ErrExprNotFound
	}
	if !allowEarly && now.Before(sess.EndsAt) {
		return ExprFinishResult{}, ErrExprNotComplete
	}
	gain := ExprRewardExp(h.Level, sess.Hours)
	h.Exp += gain
	h.Status = StatusIdle
	return ExprFinishResult{Hero: h, ExpGained: gain}, nil
}

// BeginExprPlayer persists a new training session.
func (s *Service) BeginExprPlayer(ctx context.Context, p PlayerRef, inv InventoryPort, heroID int64, hours int32) (ExprBeginResult, error) {
	if inv == nil {
		return ExprBeginResult{}, errors.New("hero: inventory port required")
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return ExprBeginResult{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return ExprBeginResult{}, ErrHeroNotFound
	}
	existing, err := s.Store.GetExprSession(ctx, p.ServerID, heroID)
	if err != nil {
		return ExprBeginResult{}, err
	}
	if existing != nil {
		return ExprBeginResult{}, ErrHeroNotIdle
	}
	wallet, _, err := inv.LoadWalletAndItems(ctx, p)
	if err != nil {
		return ExprBeginResult{}, err
	}
	now := s.now()
	res, sess, err := BeginExprOnce(h, hours, now, wallet.Gold)
	if err != nil {
		return ExprBeginResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return ExprBeginResult{}, err
	}
	if err := s.Store.SaveExprSession(ctx, sess); err != nil {
		return ExprBeginResult{}, err
	}
	if err := inv.ApplyLargessSpend(ctx, p, res.GoldSpent, 0); err != nil {
		return ExprBeginResult{}, err
	}
	return res, nil
}

// CancelExprPlayer cancels training and clears the session row.
func (s *Service) CancelExprPlayer(ctx context.Context, p PlayerRef, heroID int64) (*Hero, error) {
	h, sess, err := s.ownedExprHero(ctx, p, heroID)
	if err != nil {
		return nil, err
	}
	if err := CancelExprOnce(h, sess); err != nil {
		return nil, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return nil, err
	}
	if err := s.Store.DeleteExprSession(ctx, p.ServerID, heroID); err != nil {
		return nil, err
	}
	return h, nil
}

// FinishExprPlayer completes training when ends_at has passed.
func (s *Service) FinishExprPlayer(ctx context.Context, p PlayerRef, heroID int64) (ExprFinishResult, error) {
	h, sess, err := s.ownedExprHero(ctx, p, heroID)
	if err != nil {
		return ExprFinishResult{}, err
	}
	res, err := FinishExprOnce(h, sess, s.now(), false)
	if err != nil {
		return ExprFinishResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return ExprFinishResult{}, err
	}
	if err := s.Store.DeleteExprSession(ctx, p.ServerID, heroID); err != nil {
		return ExprFinishResult{}, err
	}
	return res, nil
}

// FasterExprPlayer is M1 “急召”简化：立即结算，等同自然结束奖励。
func (s *Service) FasterExprPlayer(ctx context.Context, p PlayerRef, heroID int64) (ExprFinishResult, error) {
	h, sess, err := s.ownedExprHero(ctx, p, heroID)
	if err != nil {
		return ExprFinishResult{}, err
	}
	res, err := FinishExprOnce(h, sess, s.now(), true)
	if err != nil {
		return ExprFinishResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return ExprFinishResult{}, err
	}
	if err := s.Store.DeleteExprSession(ctx, p.ServerID, heroID); err != nil {
		return ExprFinishResult{}, err
	}
	return res, nil
}

func (s *Service) ownedExprHero(ctx context.Context, p PlayerRef, heroID int64) (*Hero, *ExprSession, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return nil, nil, ErrHeroNotFound
	}
	sess, err := s.Store.GetExprSession(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	return h, sess, nil
}
