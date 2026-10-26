package api

import (
	"context"
	"errors"

	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

// reconcileTutorialLevel derives the unchanged phase-1 floor plus the bounded
// verified wall floor. It must not invoke fact/receipt reconciliation or
// checkUnlock, since it also supplies the unlock provider.
func (s *Server) reconcileTutorialLevel(ctx context.Context, actor quest.Actor) (int32, error) {
	if s.questSvc == nil || s.players == nil || s.players.Pool == nil || actor.ServerID <= 0 || actor.PlayerID <= 0 {
		return 0, errors.New("tutorial level persistence unavailable")
	}
	floor, err := s.questSvc.CompletedTutorialLevel(ctx, actor)
	if err != nil {
		return 0, err
	}
	if floor < 1 || floor > 5 {
		return 0, errors.New("invalid tutorial level floor")
	}
	wallFloor, err := s.questSvc.CompletedWallLevel(ctx, actor)
	if err != nil {
		return 0, err
	}
	if wallFloor != 1 && wallFloor != 6 {
		return 0, errors.New("invalid wall level floor")
	}
	if wallFloor > floor {
		floor = wallFloor
	}
	var level int32
	err = s.players.Pool.QueryRow(ctx, `UPDATE player SET level=GREATEST(level,$3)
        WHERE server_id=$1 AND player_id=$2 RETURNING level`, actor.ServerID, actor.PlayerID, floor).Scan(&level)
	// Missing actors are errors, never inserted or level 1.
	if err != nil {
		return 0, err
	}
	return level, nil
}

func (s *Server) questPlayerLevel(ctx context.Context, serverID int32, playerID int64) (int32, error) {
	return s.reconcileTutorialLevel(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID})
}

func (s *Server) refreshTutorialProfile(ctx context.Context, profile *commonpb.PlayerProfile) error {
	// Account-only deployments do not run tutorials.
	if s.questSvc == nil {
		return nil
	}
	actor := quest.Actor{ServerID: profile.GetServerId(), PlayerID: profile.GetPlayerId()}
	level, err := s.recoverWallAndLevel(ctx, actor)
	if err != nil {
		return err
	}
	profile.Level = level
	return nil
}
