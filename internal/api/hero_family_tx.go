package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

var errFamilyOutcome = errors.New("hero family commit outcome unavailable")

// Startup-only identities. All participants use the captured API transaction;
// exposed service/store rewiring cannot silently select another pool or schema.
type familyDependencies struct {
	hotel   *hotelDependencies
	coming  *hero.PGComingStore
	captive *hero.PGCaptiveStore
	lionize *hero.PGLionizeStore
}

func (s *Server) wireFamilyTransactions() {
	s.family = nil
	if s.hotel == nil || s.heroSvc == nil {
		return
	}
	coming, _ := s.heroSvc.ComingStore.(*hero.PGComingStore)
	captive, _ := s.heroSvc.CaptiveStore.(*hero.PGCaptiveStore)
	lionize, _ := s.heroSvc.LionizeStore.(*hero.PGLionizeStore)
	pool := s.hotel.pool
	if coming == nil || coming.Pool != pool || captive == nil || captive.Pool != pool || lionize == nil || lionize.Pool != pool {
		return
	}
	s.family = &familyDependencies{hotel: s.hotel, coming: coming, captive: captive, lionize: lionize}
}

func (s *Server) familyDependencies(serverID int32) *familyDependencies {
	d := s.family
	if d == nil || d.hotel == nil || s.hotelDependencies(serverID) != d.hotel ||
		d.coming == nil || d.coming.Pool != d.hotel.pool || s.heroSvc.ComingStore != d.coming ||
		d.captive == nil || d.captive.Pool != d.hotel.pool || s.heroSvc.CaptiveStore != d.captive ||
		d.lionize == nil || d.lionize.Pool != d.hotel.pool || s.heroSvc.LionizeStore != d.lionize {
		return nil
	}
	return d
}

type familyTx struct {
	tx     pgx.Tx
	d      *familyDependencies
	pc     PlayerContext
	actor  hero.PlayerRef
	assets bool
	wallet hero.Resources
}

// Sole transaction owner for every family route, including previews and lists.
// No callback may call a Pool, Hub, legacy service operation or runtime DDL.
func (s *Server) familyAtomic(ctx context.Context, pc PlayerContext, op string, run func(*familyTx) error) (err error) {
	defer func() {
		if err != nil {
			s.recruitLog().Warn("hero family failed or outcome unconfirmed", "server_id", pc.ServerID, "player_id", pc.PlayerID, "operation", op, "error", err)
		}
	}()
	if pc.ServerID <= 0 || pc.PlayerID <= 0 {
		return errRecruitActor
	}
	d := s.familyDependencies(pc.ServerID)
	if d == nil {
		return hero.ErrFamilyTransactionRequired
	}
	tx, err := d.hotel.begin(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	var accountID int64
	if err = tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR KEY SHARE`, pc.ServerID, pc.PlayerID).Scan(&accountID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errRecruitActor
		}
		return err
	}
	if pc.AccountID != 0 && pc.AccountID != accountID {
		return errRecruitActor
	}
	wallet, err := lockRecruitWallet(ctx, tx, pc)
	if err != nil {
		if errors.Is(err, hero.ErrInsufficientRes) {
			return errHotelWallet
		}
		return err
	}
	f := &familyTx{tx: tx, d: d, pc: pc, actor: hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, wallet: wallet}
	if err = run(f); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("%w: %v", errFamilyOutcome, err)
	}
	if f.assets {
		post, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if e := d.hotel.invalidate(post, content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}); e != nil {
			s.recruitLog().Warn("hero family committed; content invalidation deferred", "operation", op, "error", e)
		}
		s.refreshDomesticWalletAfterCommit(post, pc.ServerID, pc.PlayerID)
	}
	return nil
}

func (f *familyTx) city(ctx context.Context, id int64, levels bool) (domestic.HotelLevels, error) {
	var out domestic.HotelLevels
	if err := f.d.hotel.owner.LockCityOwnerInTx(ctx, f.tx, f.pc.ServerID, id, f.pc.PlayerID); err != nil {
		return out, err
	}
	if levels {
		return f.d.hotel.levels.LevelsInTx(ctx, f.tx, f.pc.ServerID, id)
	}
	return out, nil
}

func (f *familyTx) heroes(ctx context.Context, lock bool) ([]*hero.Hero, error) {
	if lock {
		return f.d.hotel.heroes.LockPlayerHeroesInTx(ctx, f.tx, f.pc.ServerID, f.pc.PlayerID)
	}
	return f.d.hotel.heroes.ListPlayerHeroesInTx(ctx, f.tx, f.pc.ServerID, f.pc.PlayerID)
}

func familyHeroByID(rows []*hero.Hero, id int64) *hero.Hero {
	for _, h := range rows {
		if h.HeroID == id {
			return h
		}
	}
	return nil
}

// CONTENT canonicalizes item IDs. Empty costs deliberately do not introduce a
// required item, but the initialized wallet is already locked for every route.
func (f *familyTx) debitItems(ctx context.Context, costs []hero.ItemCost, gold int64) error {
	if gold < 0 {
		return hero.ErrInvalidFamilyState
	}
	if len(costs) > 0 {
		// Preserve legacy item-before-gold insufficiency errors, even for persisted
		// requirements absent from the current catalog. This bag is tx-authoritative
		// and locks in item-ID order before any hero or metadata row is locked.
		bag, err := f.d.hotel.items.LoadBagInTx(ctx, f.tx, content.PlayerRef{ServerID: f.pc.ServerID, PlayerID: f.pc.PlayerID})
		if err != nil {
			return err
		}
		quantities := make(map[int32]int32, len(bag))
		for _, stack := range bag {
			quantities[stack.ItemCfgID] = stack.Quantity
		}
		for _, cost := range costs {
			if quantities[cost.ItemCfgID] < cost.Quantity {
				return hero.ErrInsufficientItem
			}
		}
	}
	if f.wallet.Gold < gold {
		return hero.ErrInsufficientGold
	}
	if len(costs) == 0 {
		return nil
	}
	stacks := make([]content.Stack, len(costs))
	for i, c := range costs {
		stacks[i] = content.Stack{ItemCfgID: c.ItemCfgID, Quantity: c.Quantity}
	}
	_, err := f.d.hotel.items.DebitItemsInTx(ctx, f.tx, content.PlayerRef{ServerID: f.pc.ServerID, PlayerID: f.pc.PlayerID}, stacks)
	if errors.Is(err, content.ErrInsufficientItems) {
		return hero.ErrInsufficientItem
	}
	f.assets = err == nil
	return err
}

func (f *familyTx) debitGold(ctx context.Context, cost int64) error {
	if cost < 0 {
		return hero.ErrInvalidFamilyState
	}
	if err := debitHotelGold(ctx, f.tx, f.pc, cost); err != nil {
		return err
	}
	f.assets = true
	return nil
}

func familyErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, errRecruitActor), errors.Is(err, world.ErrCityNotOwned):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "player or city unavailable")
	case errors.Is(err, hero.ErrFamilyTransactionRequired), errors.Is(err, errHotelWallet):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "atomic hero family unavailable")
	case errors.Is(err, errFamilyOutcome):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero outcome unavailable; reload state")
	case errors.Is(err, hero.ErrUnknownTemplate), errors.Is(err, hero.ErrAlreadyOwned), errors.Is(err, hero.ErrInvalidRecruit):
		return heroErr(trace, err)
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, "hero outcome unavailable; reload state")
	}
}
