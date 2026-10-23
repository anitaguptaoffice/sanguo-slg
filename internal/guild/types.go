package guild

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
)

// Role values align with guild_member.role (spec/db/m3_002_guild.sql).
const (
	RoleLeader  int16 = 1
	RoleOfficer int16 = 2
	RoleMember  int16 = 3
)

const (
	MinGuildNameRunes  = 2
	MaxGuildNameRunes  = 32
	DefaultMemberLimit = 50
)

// Guild is one row in guild.
type Guild struct {
	ServerID       int32
	GuildID        int64
	Name           string
	LeaderPlayerID int64
	MemberCount    int32
	MemberLimit    int32
	CreatedAt      time.Time
}

// Member is one row in guild_member plus optional display fields for API mapping.
type Member struct {
	ServerID    int32
	GuildID     int64
	PlayerID    int64
	Role        int16
	JoinedAt    time.Time
	DisplayName string
	Power       int64
}

// Actor is the authenticated player on a game shard.
type Actor struct {
	ServerID int32
	PlayerID int64
}

// PlayerDirectory resolves display fields for member list rows.
type PlayerDirectory interface {
	DisplayName(ctx context.Context, serverID int32, playerID int64) (string, error)
	PlayerPower(ctx context.Context, serverID int32, playerID int64) (int64, error)
}

func normalizeGuildName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	n := utf8.RuneCountInString(name)
	if n < MinGuildNameRunes || n > MaxGuildNameRunes {
		return "", ErrNameInvalid
	}
	for _, r := range name {
		if r < 0x20 {
			return "", ErrNameInvalid
		}
	}
	return name, nil
}

func (g Guild) ToSummary() *guildv1.GuildSummary {
	limit := g.MemberLimit
	if limit <= 0 {
		limit = DefaultMemberLimit
	}
	return &guildv1.GuildSummary{
		GuildId:        g.GuildID,
		ServerId:       g.ServerID,
		Name:           g.Name,
		LeaderPlayerId: g.LeaderPlayerID,
		MemberCount:    g.MemberCount,
		MemberLimit:    limit,
		CreatedAtMs:    g.CreatedAt.UnixMilli(),
	}
}

func (m Member) ToProto() *guildv1.GuildMember {
	return &guildv1.GuildMember{
		PlayerId:    m.PlayerID,
		DisplayName: m.DisplayName,
		Role:        roleToProto(m.Role),
		JoinedAtMs:  m.JoinedAt.UnixMilli(),
		Power:       m.Power,
	}
}

func roleToProto(role int16) guildv1.GuildMemberRole {
	switch role {
	case RoleLeader:
		return guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_LEADER
	case RoleOfficer:
		return guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_OFFICER
	case RoleMember:
		return guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_MEMBER
	default:
		return guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_UNSPECIFIED
	}
}
