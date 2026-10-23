package guild

import "context"

// Store persists guild and membership per server_id (m3_002_guild.sql).
type Store interface {
	CreateGuild(ctx context.Context, g Guild, leader Member) error
	GetGuild(ctx context.Context, serverID int32, guildID int64) (Guild, error)
	GetMembership(ctx context.Context, serverID int32, playerID int64) (Member, error)
	AddMember(ctx context.Context, serverID int32, guildID int64, member Member) error
	RemoveMember(ctx context.Context, serverID int32, playerID int64) error
	UpdateMemberRole(ctx context.Context, serverID int32, guildID int64, playerID int64, role int16) error
	ListMembers(ctx context.Context, serverID int32, guildID int64, offset, limit int) ([]Member, int32, error)
}
