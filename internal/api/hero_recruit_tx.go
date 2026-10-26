package api

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errRecruitActor = errors.New("recruit actor unavailable")

// Only WireM4Content installs these capabilities, from the same pool as players.
// Keep the transaction-only item service private so exposed service rewiring cannot
// move a participant to another database. Its cache is never read or published.
type recruitDependencies struct {
	pool       *pgxpool.Pool
	begin      func(context.Context, pgx.TxOptions) (pgx.Tx, error)
	heroes     *hero.PGStore
	items      recruitItems
	cache      *content.Service
	invalidate func(context.Context, content.PlayerRef) error
}

type recruitItems interface {
	SupportsItemTransactions() bool
	LoadBagInTx(context.Context, pgx.Tx, content.PlayerRef) ([]content.Stack, error)
	DebitItemsInTx(context.Context, pgx.Tx, content.PlayerRef, []content.Stack) ([]content.Stack, error)
}

func (s *Server) wireRecruitTransactions(cat *content.Catalog) {
	s.recruit = nil
	if s.players == nil || s.players.Pool == nil || s.heroSvc == nil || s.contentSvc == nil {
		return
	}
	store, ok := s.heroSvc.Store.(*hero.PGStore)
	if !ok || store == nil || store.Pool != s.players.Pool {
		return
	}
	items := content.NewService(cat)
	items.UseStore(content.NewPGStore(s.players.Pool))
	s.recruit = &recruitDependencies{pool: s.players.Pool, begin: s.players.Pool.BeginTx, heroes: store, items: items, cache: s.contentSvc,
		invalidate: s.contentSvc.InvalidatePlayerContext}
}

// recruitHeroAtomic owns the only transaction/commit decision. No legacy Spend,
// Remove, RecruitPlayer, compensating write, or cache-derived debit is permitted.
func (s *Server) recruitHeroAtomic(ctx context.Context, pc PlayerContext, req hero.RecruitRequest) (*hero.Hero, error) {
	if pc.ServerID <= 0 || pc.PlayerID <= 0 {
		return nil, errRecruitActor
	}
	d := s.recruit
	if d == nil || s.players == nil || d.pool == nil || d.begin == nil || d.pool != s.players.Pool ||
		s.heroSvc == nil || d.heroes == nil || s.heroSvc.Store != d.heroes || d.heroes.Pool != d.pool ||
		d.items == nil || !d.items.SupportsItemTransactions() || d.invalidate == nil || s.contentSvc == nil || s.contentSvc != d.cache || !s.contentSvc.SupportsItemTransactions() {
		return nil, hero.ErrRecruitTransactionRequired
	}
	tx, err := d.begin(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	// A bound session is not proof that its player still exists. Hold the actor row
	// while purchasing; account identity is additionally checked when present.
	var accountID int64
	err = tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR KEY SHARE`, pc.ServerID, pc.PlayerID).Scan(&accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errRecruitActor
	}
	if err != nil {
		return nil, err
	}
	if pc.AccountID != 0 && pc.AccountID != accountID {
		return nil, errRecruitActor
	}
	wallet, err := lockRecruitWallet(ctx, tx, pc)
	if err != nil {
		return nil, err
	}
	owned, err := d.heroes.ListPlayerHeroesInTx(ctx, tx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	p := content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	bag, err := d.items.LoadBagInTx(ctx, tx, p)
	if err != nil {
		return nil, err
	}
	items := make(map[int32]int32, len(bag))
	for _, st := range bag {
		items[st.ItemCfgID] = st.Quantity
	}
	plan, err := s.heroSvc.PlanRecruit(&hero.PlayerState{ServerID: pc.ServerID, PlayerID: pc.PlayerID,
		Wallet: wallet, Items: items, Heroes: owned}, req)
	if err != nil {
		return nil, err
	}
	if err = debitRecruitWallet(ctx, tx, pc, plan.ResourceDebit); err != nil {
		return nil, err
	}
	costs := make([]content.Stack, len(plan.ItemDebits))
	for i, cost := range plan.ItemDebits {
		costs[i] = content.Stack{ItemCfgID: cost.ItemCfgID, Quantity: cost.Quantity}
	}
	if _, err = d.items.DebitItemsInTx(ctx, tx, p, costs); err != nil {
		if errors.Is(err, content.ErrInsufficientItems) {
			return nil, hero.ErrInsufficientItem
		}
		return nil, err
	}
	if err = d.heroes.CreateHeroInTx(ctx, tx, plan.Hero); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_player_hero_template_once" {
			return nil, hero.ErrAlreadyOwned
		}
		return nil, err // Identity collisions never masquerade as duplicate templates.
	}
	if err = tx.Commit(ctx); err != nil {
		// This may be an unknown outcome. Never replay, compensate, or assert rollback.
		s.recruitLog().Error("recruit commit not confirmed; refresh durable state before retry", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
		return nil, err
	}
	// Publish no provisional identity/cache/quest event before confirmed commit.
	if err := d.invalidate(ctx, p); err != nil {
		s.recruitLog().Warn("recruit committed; content invalidation deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
	}
	s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
	return plan.Hero, nil
}

func lockRecruitWallet(ctx context.Context, tx pgx.Tx, pc PlayerContext) (hero.Resources, error) {
	var have hero.Resources
	err := tx.QueryRow(ctx, `SELECT food,wood,stone,iron,gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, pc.ServerID, pc.PlayerID).Scan(&have.Food, &have.Wood, &have.Stone, &have.Iron, &have.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return have, hero.ErrInsufficientRes
	}
	return have, err
}

func debitRecruitWallet(ctx context.Context, tx pgx.Tx, pc PlayerContext, cost hero.Resources) error {
	if cost.Food < 0 || cost.Wood < 0 || cost.Stone < 0 || cost.Iron < 0 || cost.Gold != 0 {
		return hero.ErrInvalidRecruit
	}
	tag, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food-$3,wood=wood-$4,stone=stone-$5,iron=iron-$6,updated_at=NOW()
  WHERE server_id=$1 AND player_id=$2 AND food>=$3 AND wood>=$4 AND stone>=$5 AND iron>=$6`,
		pc.ServerID, pc.PlayerID, cost.Food, cost.Wood, cost.Stone, cost.Iron)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return hero.ErrInsufficientRes
	}
	return nil
}

func (s *Server) recruitLog() *slog.Logger {
	if s.log != nil {
		return s.log
	}
	return slog.Default()
}

func (s *Server) recruitError(trace string, err error) *commonv1.ServerPacket {
	if errors.Is(err, errRecruitActor) {
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "player unavailable")
	}
	if errors.Is(err, hero.ErrRecruitTransactionRequired) {
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "atomic recruitment unavailable")
	}
	resp := heroErr(trace, err)
	if resp.Code == int32(commonv1.ErrorCode_COMMON_INTERNAL) {
		s.recruitLog().Error("recruit failed or outcome unconfirmed", "error", err)
		resp.Msg = "recruit outcome unavailable; refresh hero and inventory state"
	}
	return resp
}
