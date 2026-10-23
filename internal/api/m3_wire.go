package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	"github.com/jackc/pgx/v5/pgxpool"
)

// wireM3 links chat, guild, and rank domain handlers into the assembly layer (INTG-003).
func (s *Server) wireM3(pool *pgxpool.Pool) {
	if pool == nil {
		return
	}
	resolver := &m3Sessions{sessions: s.sessions, players: s.players}
	chatStore := guild.WrapChatStore(chat.NewPGStore(pool))
	chatSvc := chat.NewService(chatStore, s.players)
	guildSvc := guild.NewService(guild.NewPGStore(pool), s.players)
	coord := guild.NewChatCoordinator(guildSvc, chatSvc, chatStore, s.players)

	guild.RegisterM3Chat(s.m3, coord, chatSessionBridge{resolver})
	guild.RegisterM3(s.m3, guildSvc, guildSessionBridge{resolver})

	s.wireHeroService(pool)

	s.rankSvc = rank.NewService(rank.NewPGStore(pool), newPGRankSource(pool))
	s.rankSch = rank.NewScheduler(s.rankSvc, rank.DefaultRefreshInterval)
	s.rankSch.Configure([]int32{defaultServerID}, []rank.RankType{rank.RankPlayerPower, rank.RankPlayerResource})
	for route, h := range rankGatewayHandlers(s.rankSvc, s.sessions) {
		s.m3.Register(route, h)
	}
}

// RunRankScheduler ticks leaderboard refresh until ctx is cancelled.
func (s *Server) RunRankScheduler(ctx context.Context) {
	if s.rankSch == nil {
		return
	}
	s.rankSch.Run(ctx)
}

// RefreshRanks runs one leaderboard refresh pass (smoke tests and manual triggers).
func (s *Server) RefreshRanks(ctx context.Context) error {
	if s.rankSch == nil {
		return nil
	}
	return s.rankSch.Tick(ctx)
}
