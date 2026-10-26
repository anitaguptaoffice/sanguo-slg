package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type hotelOperation string

const (
	hotelRecruit hotelOperation = "recruit"
	hotelList    hotelOperation = "list"
	hotelRefresh hotelOperation = "refresh"
)

var (
	errHotelWallet  = errors.New("hotel initialized wallet unavailable")
	errHotelOutcome = errors.New("hotel commit outcome unavailable")
)

// Startup-only private capabilities: identity checks reject exposed-service
// rewiring; every operation uses the captured BeginTx and supplied tx, not a
// participant's mutable Pool. Deployment requires the compatible sibling set.
type hotelDependencies struct {
	pool       *pgxpool.Pool
	begin      func(context.Context, pgx.TxOptions) (pgx.Tx, error)
	service    *hero.Service
	heroes     *hero.PGStore
	candidates *hero.PGHotelStore
	world      *world.Service
	owner      *world.PGStore
	domestic   *domestic.Hub
	levels     *domestic.HotelLevelPort
	items      *content.Service
	itemStore  *content.PGStore
	cache      *content.Service
	invalidate func(context.Context, content.PlayerRef) error
}

func (s *Server) wireHotelTransactions(cat *content.Catalog) {
	s.hotel = nil
	if s.players == nil || s.players.Pool == nil || s.heroSvc == nil || s.world == nil || s.domestic == nil || s.contentSvc == nil {
		return
	}
	heroes, _ := s.heroSvc.Store.(*hero.PGStore)
	candidates, _ := s.heroSvc.HotelStore.(*hero.PGHotelStore)
	owner, _ := s.world.Store.(*world.PGStore)
	pool := s.players.Pool
	if heroes == nil || heroes.Pool != pool || candidates == nil || candidates.Pool != pool || owner == nil || owner.Pool != pool {
		return
	}
	items, itemStore := content.NewService(cat), content.NewPGStore(pool)
	items.UseStore(itemStore)
	s.hotel = &hotelDependencies{pool: pool, begin: pool.BeginTx, service: s.heroSvc,
		heroes: heroes, candidates: candidates, world: s.world, owner: owner,
		domestic: s.domestic, levels: s.domestic.HotelLevelsPort(), items: items, itemStore: itemStore,
		cache: s.contentSvc, invalidate: s.contentSvc.InvalidatePlayerContext}
}

func (s *Server) hotelDependencies(serverID int32) *hotelDependencies {
	d := s.hotel
	if d == nil || d.pool == nil || d.begin == nil || s.players == nil || s.players.Pool != d.pool ||
		s.heroSvc == nil || s.heroSvc != d.service || d.heroes == nil || d.heroes.Pool != d.pool || s.heroSvc.Store != d.heroes ||
		d.candidates == nil || d.candidates.Pool != d.pool || s.heroSvc.HotelStore != d.candidates ||
		s.world == nil || s.world != d.world || d.owner == nil || d.owner.Pool != d.pool || s.world.Store != d.owner ||
		s.domestic != d.domestic || !d.levels.Supports(d.pool, serverID) ||
		d.items == nil || !d.items.SupportsItemTransactions() || d.itemStore == nil || d.itemStore.Pool != d.pool ||
		s.contentSvc == nil || s.contentSvc != d.cache || !s.contentSvc.SupportsItemTransactions() || d.invalidate == nil {
		return nil
	}
	return d
}

type hotelSnapshot struct {
	candidates []*hero.HotelCandidate
	levels     domestic.HotelLevels
	owned      int
	hero       *hero.Hero
}

// hotelAtomic is the sole transaction owner, including list's implicit sync.
// Never enter Hub/cache operations or legacy hotel methods inside this boundary.
func (s *Server) hotelAtomic(ctx context.Context, pc PlayerContext, cityID, candidateID int64, op hotelOperation) (out hotelSnapshot, err error) {
	defer func() {
		if err != nil {
			s.recruitLog().Warn("hotel failed or outcome unconfirmed", "server_id", pc.ServerID,
				"player_id", pc.PlayerID, "city_id", cityID, "candidate_id", candidateID, "operation", op, "error", err)
		}
	}()
	if pc.ServerID <= 0 || pc.PlayerID <= 0 {
		return out, errRecruitActor
	}
	if cityID <= 0 || (op == hotelRecruit && candidateID <= 0) || (op != hotelList && op != hotelRefresh && op != hotelRecruit) {
		return out, hero.ErrInvalidHotelState
	}
	d := s.hotelDependencies(pc.ServerID)
	if d == nil {
		return out, hero.ErrHotelTransactionRequired
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
	if _, err = lockRecruitWallet(ctx, tx, pc); err != nil {
		if errors.Is(err, hero.ErrInsufficientRes) {
			err = errHotelWallet
		}
		return out, err
	}
	if err = d.owner.LockCityOwnerInTx(ctx, tx, pc.ServerID, cityID, pc.PlayerID); err != nil {
		return out, err
	}
	if out.levels, err = d.levels.LevelsInTx(ctx, tx, pc.ServerID, cityID); err != nil {
		return out, err
	}
	if out.levels.Hotel <= 0 {
		return out, hero.ErrHotelNotBuilt
	}
	// Acquire item locks before candidate locks; this is the existing fixed fee,
	// not client input. The plan preserves the same fee and generation rules.
	if op == hotelRefresh {
		_, err = d.items.DebitItemsInTx(ctx, tx, content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
			[]content.Stack{{ItemCfgID: hero.HotelRefreshItemCfgID, Quantity: 1}})
		if errors.Is(err, content.ErrInsufficientItems) {
			err = hero.ErrInsufficientItem
		}
		if err != nil {
			return out, err
		}
	}
	owned, err := d.heroes.ListPlayerHeroesInTx(ctx, tx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return out, err
	}
	out.owned = hero.CountOwnedHeroes(owned)
	rows, err := d.candidates.ListCandidatesInTx(ctx, tx, pc.ServerID, cityID)
	if err != nil {
		return out, err
	}
	if op == hotelRecruit {
		out.hero, err = d.hotelRecruitInTx(ctx, tx, pc, cityID, candidateID, out.levels, owned, rows)
	} else {
		out.candidates, err = d.hotelPoolInTx(ctx, tx, pc.ServerID, cityID, out.levels.Hotel, rows, op)
	}
	if err != nil {
		return out, err
	}
	if err = tx.Commit(ctx); err != nil {
		return hotelSnapshot{}, fmt.Errorf("%w: %v", errHotelOutcome, err)
	}
	if op != hotelList {
		s.hotelAfterCommit(ctx, pc, op, d)
	}
	return out, nil
}

func (d *hotelDependencies) hotelPoolInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64, level int32, rows []*hero.HotelCandidate, op hotelOperation) ([]*hero.HotelCandidate, error) {
	last, err := d.candidates.LastPoolTickInTx(ctx, tx, serverID, cityID)
	if err != nil {
		return nil, err
	}
	var plan hero.HotelPoolPlan
	if op == hotelRefresh {
		plan, err = d.service.PlanHotelRefresh(serverID, hero.CityRef{CityID: cityID}, level)
	} else {
		plan, err = d.service.PlanHotelSync(serverID, hero.CityRef{CityID: cityID}, level, rows, last)
	}
	if err != nil {
		return nil, err
	}
	if plan.Replace {
		for _, c := range plan.Candidates {
			if c.CandidateID == 0 {
				c.CandidateID, err = d.candidates.NextCandidateIDInTx(ctx, tx, serverID, cityID)
				if err != nil {
					return nil, err
				}
			}
		}
		if err = d.candidates.ReplaceCandidatesInTx(ctx, tx, serverID, cityID, plan.Candidates); err != nil {
			return nil, err
		}
	}
	if plan.SaveTick {
		if err = d.candidates.SetLastPoolTickInTx(ctx, tx, serverID, cityID, plan.Tick); err != nil {
			return nil, err
		}
	}
	return plan.Candidates, nil
}
