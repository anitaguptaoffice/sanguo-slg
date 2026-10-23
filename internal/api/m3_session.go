package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
)

// m3Sessions resolves gateway session_id to chat/guild actors (same shard binding as gameplay routes).
type m3Sessions struct {
	sessions *SessionRegistry
	players  *PlayerStore
}

func (r *m3Sessions) chatActor(ctx context.Context, sessionID string) (chat.Actor, error) {
	pc, ok := r.sessions.Get(sessionID)
	if !ok || pc.PlayerID == 0 || pc.ServerID == 0 {
		return chat.Actor{}, chat.ErrUnauthorized
	}
	name, _ := r.players.DisplayName(ctx, pc.ServerID, pc.PlayerID)
	return chat.Actor{
		ServerID:    pc.ServerID,
		PlayerID:    pc.PlayerID,
		DisplayName: name,
	}, nil
}

func (r *m3Sessions) guildActor(ctx context.Context, sessionID string) (guild.Actor, error) {
	pc, ok := r.sessions.Get(sessionID)
	if !ok || pc.PlayerID == 0 || pc.ServerID == 0 {
		return guild.Actor{}, guild.ErrUnauthorized
	}
	return guild.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, nil
}

type chatSessionBridge struct{ parent *m3Sessions }

func (b chatSessionBridge) ActorForSession(ctx context.Context, sessionID string) (chat.Actor, error) {
	return b.parent.chatActor(ctx, sessionID)
}

type guildSessionBridge struct{ parent *m3Sessions }

func (b guildSessionBridge) ActorForSession(ctx context.Context, sessionID string) (guild.Actor, error) {
	return b.parent.guildActor(ctx, sessionID)
}
