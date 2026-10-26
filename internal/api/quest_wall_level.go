package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

// Recovery may read facts/receipts and repair quest history, but is never the
// level provider. Keeping these entry paths separate prevents recursive unlock
// evaluation and old completed rows bootstrapping their own floor6 eligibility.
func (s *Server) recoverWallAndLevel(ctx context.Context, actor quest.Actor) (int32, error) {
	if s.questSvc == nil {
		return 0, errors.New("wall progress persistence unavailable")
	}
	if err := s.requireWallActor(ctx, actor); err != nil {
		return 0, err
	}
	if err := s.questSvc.RecoverWall(ctx, actor); err != nil {
		return 0, err
	}
	return s.reconcileTutorialLevel(ctx, actor)
}

// Already-committed actions are hints, never proof or permission to replay.
// A missed hint/read failure is repaired by task reads/login/explicit Claim.
func (s *Server) questAfterWallHint(ctx context.Context, serverID int32, playerID int64) {
	if s.questSvc == nil {
		return
	}
	actor := quest.Actor{ServerID: serverID, PlayerID: playerID}
	if err := s.requireWallActor(ctx, actor); err != nil {
		s.recruitLog().Warn("wall actor unavailable; refresh deferred", "server_id", serverID, "player_id", playerID, "error", err)
		return
	}
	if err := s.questSvc.RecoverWall(ctx, actor); err != nil {
		s.recruitLog().Warn("wall progress refresh deferred", "server_id", serverID, "player_id", playerID, "error", err)
	}
}

// A stale session or hint is not current player existence. This API-owned
// preflight precedes any wall receipt/history write; it never creates an actor.
func (s *Server) requireWallActor(ctx context.Context, actor quest.Actor) error {
	if s.players == nil || s.players.Pool == nil || actor.ServerID <= 0 || actor.PlayerID <= 0 {
		return errors.New("wall actor unavailable")
	}
	var present int
	return s.players.Pool.QueryRow(ctx, `SELECT 1 FROM player WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&present)
}
