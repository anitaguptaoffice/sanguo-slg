package api

import (
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5"
)

func (d *hotelDependencies) hotelRecruitInTx(ctx context.Context, tx pgx.Tx, pc PlayerContext, cityID, candidateID int64, levels domestic.HotelLevels, owned []*hero.Hero, rows []*hero.HotelCandidate) (*hero.Hero, error) {
	var candidate *hero.HotelCandidate
	for _, row := range rows {
		if row.CandidateID == candidateID {
			candidate = row
			break
		}
	}
	plan, err := d.service.PlanHotelRecruit(hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
		hero.CityRef{CityID: cityID}, levels.Hotel, levels.Office, owned, candidateID, candidate)
	if err != nil {
		return nil, err
	}
	if err = debitHotelGold(ctx, tx, pc, plan.GoldDebit); err != nil {
		return nil, err
	}
	if err = d.candidates.ConsumeCandidateInTx(ctx, tx, pc.ServerID, cityID, plan.CandidateID); err != nil {
		return nil, err
	}
	if err = d.heroes.CreateHeroInTx(ctx, tx, plan.Hero); err != nil {
		return nil, err
	}
	return plan.Hero, nil
}

func debitHotelGold(ctx context.Context, tx pgx.Tx, pc PlayerContext, cost int64) error {
	if cost < 0 {
		return hero.ErrInvalidHotelState
	}
	// Even a zero-cost candidate retains all serialization locks and requires an
	// existing wallet. Four resources are never read-modify-written from cache.
	tag, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-$3,updated_at=NOW()
		WHERE server_id=$1 AND player_id=$2 AND gold>=$3`, pc.ServerID, pc.PlayerID, cost)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return hero.ErrInsufficientGold
	}
	return nil
}

func (s *Server) hotelAfterCommit(ctx context.Context, pc PlayerContext, op hotelOperation, d *hotelDependencies) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := d.invalidate(ctx, content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}); err != nil {
		s.recruitLog().Warn("hotel committed; content invalidation deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
	}
	if op != hotelRecruit {
		return
	}
	s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
	if s.questSvc == nil {
		return
	}
	actor := quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if err := s.questSvc.ApplyProgressEvent(ctx, actor, quest.ProgressEvent{Kind: quest.EventRecruitHero}); err != nil {
		s.recruitLog().Warn("hotel committed; recruit quest signal deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
	}
	if err := s.questSvc.ReconcileTutorial(ctx, actor); err != nil {
		s.recruitLog().Warn("hotel committed; tutorial reconciliation deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
	}
}
