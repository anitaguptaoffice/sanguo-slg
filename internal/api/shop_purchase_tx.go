package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errShopBinding = errors.New("atomic shop unavailable")
	errShopOutcome = errors.New("shop commit outcome unavailable")
)

type shopPurchaseDependencies struct {
	pool       *pgxpool.Pool
	begin      func(context.Context, pgx.TxOptions) (pgx.Tx, error)
	service    *shop.Service
	store      *shop.PGStore
	items      *content.Service
	itemStore  *content.PGStore
	catalog    *content.Catalog
	cache      *content.Service
	invalidate func(context.Context, content.PlayerRef) error
}

// Startup-only capture of exact same-pool participants. The private item service
// has no independently published state, and every write uses our supplied tx.
func (s *Server) wireShopTransactions(cat *content.Catalog, store *shop.PGStore) {
	s.shopPurchase = nil
	if s.players == nil || s.players.Pool == nil || s.shopSvc == nil || s.contentSvc == nil || cat == nil || store == nil {
		return
	}
	pool := s.players.Pool
	if !s.shopSvc.UsesPurchaseStore(store, pool) || !s.contentSvc.SupportsItemTransactionsFor(pool, cat) {
		return
	}
	items, itemStore := content.NewService(cat), content.NewPGStore(pool)
	items.UseStore(itemStore)
	s.shopPurchase = &shopPurchaseDependencies{pool: pool, begin: pool.BeginTx, service: s.shopSvc, store: store,
		items: items, itemStore: itemStore, catalog: cat, cache: s.contentSvc, invalidate: s.contentSvc.InvalidatePlayerContext}
}

func (s *Server) shopPurchaseDependencies() *shopPurchaseDependencies {
	d := s.shopPurchase
	if d == nil || d.pool == nil || d.begin == nil || s.players == nil || s.players.Pool != d.pool ||
		s.shopSvc == nil || s.shopSvc != d.service || !d.service.UsesPurchaseStore(d.store, d.pool) ||
		d.items == nil || d.itemStore == nil || d.itemStore.Pool != d.pool || !d.items.SupportsItemTransactionsFor(d.pool, d.catalog) ||
		s.contentSvc == nil || s.contentSvc != d.cache || !d.cache.SupportsItemTransactionsFor(d.pool, d.catalog) ||
		s.contentCatalog == nil || s.contentCatalog.service != d.cache || s.contentCatalog.catalog != d.catalog || d.invalidate == nil {
		return nil
	}
	return d
}

type shopPurchaseSnapshot struct {
	offer      shop.Offer
	granted    []content.RewardItem
	wallet     content.ResourceWallet
	purchaseID int64
	receipt    content.GrantReceipt
}

// purchaseShopAtomic is the sole owner. It never invokes legacy Purchase/Spend/
// Grant, compensates an uncertain result, or retries a business operation.
func (s *Server) purchaseShopAtomic(ctx context.Context, pc PlayerContext, offerID, count int32) (out shopPurchaseSnapshot, err error) {
	var auditPurchaseID, auditGrantID int64
	defer func() {
		if err != nil {
			s.recruitLog().Warn("shop failed or outcome unconfirmed", "server_id", pc.ServerID, "player_id", pc.PlayerID, "offer_id", offerID, "purchase_id", auditPurchaseID, "grant_id", auditGrantID, "error", err)
		}
	}()
	if pc.ServerID <= 0 || pc.PlayerID <= 0 {
		return out, errRecruitActor
	}
	d := s.shopPurchaseDependencies()
	if d == nil {
		return out, errShopBinding
	}
	player := content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	intent, err := d.service.PreparePurchase(player, offerID, count)
	if err != nil {
		return out, err
	}
	tx, err := d.begin(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return out, err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	var accountID int64
	if err = tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR KEY SHARE`, pc.ServerID, pc.PlayerID).Scan(&accountID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = errRecruitActor
		}
		return out, err
	}
	if pc.AccountID != 0 && pc.AccountID != accountID {
		return out, errRecruitActor
	}
	have, err := lockShopWallet(ctx, tx, pc)
	if err != nil {
		return out, err
	}
	if _, err = d.items.LoadBagInTx(ctx, tx, player); err != nil {
		return out, err
	}
	state, err := d.store.LockPurchaseStateInTx(ctx, tx, intent)
	if err != nil {
		return out, err
	}
	plan, err := d.service.PlanPurchase(intent, state)
	if err != nil {
		return out, err
	}
	if out.wallet, err = debitShopWallet(ctx, tx, pc, have, plan.WalletCost()); err != nil {
		return out, err
	}
	if _, err = d.items.DebitItemsInTx(ctx, tx, player, plan.ItemCosts()); err != nil {
		if errors.Is(err, content.ErrInsufficientItems) {
			err = shop.ErrInsufficientItems
		}
		return out, err
	}
	if out.purchaseID, err = d.store.RecordPurchaseInTx(ctx, tx, plan); err != nil {
		return out, err
	}
	reward := plan.Reward()
	if out.receipt, err = d.items.CreateItemGrantInTx(ctx, tx, player, reward, content.ItemGrantSource{OfferID: offerID, PurchaseID: out.purchaseID}); err != nil {
		return out, err
	}
	auditPurchaseID, auditGrantID = out.purchaseID, out.receipt.GrantID
	if err = ctx.Err(); err != nil {
		return out, err
	}
	if err = tx.Commit(ctx); err != nil {
		return shopPurchaseSnapshot{}, fmt.Errorf("%w: %v", errShopOutcome, err)
	}
	out.offer, out.granted = plan.Offer(), reward.Items
	if cacheErr := d.invalidate(ctx, player); cacheErr != nil {
		s.recruitLog().Error("shop committed; bag refresh deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "purchase_id", out.purchaseID, "error", cacheErr)
	}
	s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
	return out, nil
}
