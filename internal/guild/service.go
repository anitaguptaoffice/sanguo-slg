package guild

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
)

// Service implements guild lifecycle on one game shard.
type Service struct {
	store   Store
	players PlayerDirectory
	now     func() time.Time
}

// NewService wires dependencies. players may be nil (display names default empty).
func NewService(store Store, players PlayerDirectory) *Service {
	return &Service{
		store:   store,
		players: players,
		now:     time.Now,
	}
}

// SetClock overrides time (tests).
func (s *Service) SetClock(fn func() time.Time) {
	if fn != nil {
		s.now = fn
	}
}

func (s *Service) serverID(actor Actor, reqServerID int32) (int32, error) {
	if actor.PlayerID == 0 {
		return 0, ErrUnauthorized
	}
	if reqServerID != 0 && reqServerID != actor.ServerID {
		return 0, ErrWrongServer
	}
	return actor.ServerID, nil
}

// CreateGuild creates a legion and makes the actor leader.
func (s *Service) CreateGuild(ctx context.Context, actor Actor, req *guildv1.CreateGuildRequest) (*guildv1.CreateGuildResponse, error) {
	serverID, err := s.serverID(actor, req.GetServerId())
	if err != nil {
		return nil, err
	}
	name, err := normalizeGuildName(req.GetName())
	if err != nil {
		return nil, err
	}
	if _, err := s.store.GetMembership(ctx, serverID, actor.PlayerID); err == nil {
		return nil, ErrAlreadyMember
	} else if !errors.Is(err, ErrNotMember) {
		return nil, err
	}
	now := s.now()
	g := Guild{
		ServerID:       serverID,
		Name:           name,
		LeaderPlayerID: actor.PlayerID,
		MemberLimit:    DefaultMemberLimit,
		MemberCount:    1,
		CreatedAt:      now,
	}
	leader := Member{
		ServerID: serverID,
		PlayerID: actor.PlayerID,
		Role:     RoleLeader,
		JoinedAt: now,
	}
	if err := s.store.CreateGuild(ctx, g, leader); err != nil {
		return nil, err
	}
	created, err := s.store.GetMembership(ctx, serverID, actor.PlayerID)
	if err != nil {
		return nil, err
	}
	summary, err := s.store.GetGuild(ctx, serverID, created.GuildID)
	if err != nil {
		return nil, err
	}
	return &guildv1.CreateGuildResponse{Guild: summary.ToSummary()}, nil
}

// JoinGuild adds the actor to an existing guild on the same shard.
func (s *Service) JoinGuild(ctx context.Context, actor Actor, req *guildv1.JoinGuildRequest) (*guildv1.JoinGuildResponse, error) {
	serverID, err := s.serverID(actor, req.GetServerId())
	if err != nil {
		return nil, err
	}
	guildID := req.GetGuildId()
	if guildID == 0 {
		return nil, ErrNotFound
	}
	if _, err := s.store.GetMembership(ctx, serverID, actor.PlayerID); err == nil {
		return nil, ErrAlreadyMember
	} else if !errors.Is(err, ErrNotMember) {
		return nil, err
	}
	g, err := s.store.GetGuild(ctx, serverID, guildID)
	if err != nil {
		return nil, err
	}
	limit := g.MemberLimit
	if limit <= 0 {
		limit = DefaultMemberLimit
	}
	if g.MemberCount >= limit {
		return nil, ErrFull
	}
	member := Member{
		PlayerID: actor.PlayerID,
		JoinedAt: s.now(),
		Role:     RoleMember,
	}
	if err := s.store.AddMember(ctx, serverID, guildID, member); err != nil {
		return nil, err
	}
	g, err = s.store.GetGuild(ctx, serverID, guildID)
	if err != nil {
		return nil, err
	}
	return &guildv1.JoinGuildResponse{Guild: g.ToSummary()}, nil
}

// LeaveGuild removes the actor from their current guild.
func (s *Service) LeaveGuild(ctx context.Context, actor Actor, req *guildv1.LeaveGuildRequest) (*guildv1.LeaveGuildResponse, error) {
	serverID, err := s.serverID(actor, req.GetServerId())
	if err != nil {
		return nil, err
	}
	mem, err := s.store.GetMembership(ctx, serverID, actor.PlayerID)
	if err != nil {
		return nil, err
	}
	if mem.Role == RoleLeader {
		return nil, ErrLeaderCannotLeave
	}
	if err := s.store.RemoveMember(ctx, serverID, actor.PlayerID); err != nil {
		return nil, err
	}
	return &guildv1.LeaveGuildResponse{}, nil
}

// ListGuildMembers returns a page of members for a guild on the actor's shard.
func (s *Service) ListGuildMembers(ctx context.Context, actor Actor, req *guildv1.ListGuildMembersRequest) (*guildv1.ListGuildMembersResponse, error) {
	serverID, err := s.serverID(actor, req.GetServerId())
	if err != nil {
		return nil, err
	}
	guildID := req.GetGuildId()
	if guildID == 0 {
		return nil, ErrNotFound
	}
	g, err := s.store.GetGuild(ctx, serverID, guildID)
	if err != nil {
		return nil, err
	}
	page := req.GetPage()
	if page <= 0 {
		page = 1
	}
	pageSize := req.GetPageSize()
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := int((page - 1) * pageSize)
	rows, total, err := s.store.ListMembers(ctx, serverID, guildID, offset, int(pageSize))
	if err != nil {
		return nil, err
	}
	for i := range rows {
		s.enrichMember(ctx, &rows[i])
	}
	out := make([]*guildv1.GuildMember, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.ToProto())
	}
	return &guildv1.ListGuildMembersResponse{
		Guild:      g.ToSummary(),
		Members:    out,
		TotalCount: total,
	}, nil
}

// RequireGuildMember ensures the player belongs to guildID on the shard (for guild chat).
func (s *Service) RequireGuildMember(ctx context.Context, serverID int32, playerID, guildID int64) error {
	if guildID == 0 {
		return ErrGuildRequired
	}
	mem, err := s.store.GetMembership(ctx, serverID, playerID)
	if err != nil {
		if errors.Is(err, ErrNotMember) {
			return chat.ErrChannelForbidden
		}
		return err
	}
	if mem.GuildID != guildID {
		return chat.ErrChannelForbidden
	}
	return nil
}

func canManageMembers(role int16) bool {
	return role == RoleLeader || role == RoleOfficer
}

func (s *Service) enrichMember(ctx context.Context, m *Member) {
	if s.players == nil {
		return
	}
	if name, err := s.players.DisplayName(ctx, m.ServerID, m.PlayerID); err == nil {
		m.DisplayName = name
	}
	if power, err := s.players.PlayerPower(ctx, m.ServerID, m.PlayerID); err == nil {
		m.Power = power
	}
}
