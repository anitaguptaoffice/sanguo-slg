package guild

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists guild rows per spec/db/m3_002_guild.sql.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) CreateGuild(ctx context.Context, g Guild, leader Member) error {
	if g.MemberLimit <= 0 {
		g.MemberLimit = DefaultMemberLimit
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var guildID int64
	if g.GuildID == 0 {
		if err := tx.QueryRow(ctx, `
			SELECT COALESCE(MAX(guild_id), 0) + 1 FROM guild WHERE server_id = $1
		`, g.ServerID).Scan(&guildID); err != nil {
			return err
		}
	} else {
		guildID = g.GuildID
	}
	created := g.CreatedAt
	if created.IsZero() {
		created = time.Now()
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO guild (server_id, guild_id, name, leader_player_id, member_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, $5, $5)
	`, g.ServerID, guildID, g.Name, g.LeaderPlayerID, created)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrNameTaken
		}
		return err
	}
	role := leader.Role
	if role == 0 {
		role = RoleLeader
	}
	joined := leader.JoinedAt
	if joined.IsZero() {
		joined = created
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO guild_member (server_id, guild_id, player_id, role, joined_at)
		VALUES ($1, $2, $3, $4, $5)
	`, g.ServerID, guildID, leader.PlayerID, role, joined)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrAlreadyMember
		}
		return err
	}
	return tx.Commit(ctx)
}

func (p *PGStore) GetGuild(ctx context.Context, serverID int32, guildID int64) (Guild, error) {
	var g Guild
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, guild_id, name, leader_player_id, member_count, created_at
		FROM guild WHERE server_id = $1 AND guild_id = $2
	`, serverID, guildID).Scan(&g.ServerID, &g.GuildID, &g.Name, &g.LeaderPlayerID, &g.MemberCount, &g.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Guild{}, ErrNotFound
	}
	if err != nil {
		return Guild{}, err
	}
	g.MemberLimit = DefaultMemberLimit
	return g, nil
}

func (p *PGStore) GetMembership(ctx context.Context, serverID int32, playerID int64) (Member, error) {
	var m Member
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, guild_id, player_id, role, joined_at
		FROM guild_member WHERE server_id = $1 AND player_id = $2
	`, serverID, playerID).Scan(&m.ServerID, &m.GuildID, &m.PlayerID, &m.Role, &m.JoinedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrNotMember
	}
	return m, err
}

func (p *PGStore) AddMember(ctx context.Context, serverID int32, guildID int64, member Member) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var count int32
	err = tx.QueryRow(ctx, `
		SELECT member_count FROM guild WHERE server_id = $1 AND guild_id = $2 FOR UPDATE
	`, serverID, guildID).Scan(&count)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if count >= DefaultMemberLimit {
		return ErrFull
	}
	role := member.Role
	if role == 0 {
		role = RoleMember
	}
	joined := member.JoinedAt
	if joined.IsZero() {
		joined = time.Now()
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO guild_member (server_id, guild_id, player_id, role, joined_at)
		VALUES ($1, $2, $3, $4, $5)
	`, serverID, guildID, member.PlayerID, role, joined)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrAlreadyMember
		}
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE guild SET member_count = member_count + 1, updated_at = now()
		WHERE server_id = $1 AND guild_id = $2
	`, serverID, guildID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *PGStore) UpdateMemberRole(ctx context.Context, serverID int32, guildID int64, playerID int64, role int16) error {
	tag, err := p.Pool.Exec(ctx, `
		UPDATE guild_member SET role = $4
		WHERE server_id = $1 AND guild_id = $2 AND player_id = $3
	`, serverID, guildID, playerID, role)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotMember
	}
	return nil
}

func (p *PGStore) RemoveMember(ctx context.Context, serverID int32, playerID int64) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var guildID int64
	err = tx.QueryRow(ctx, `
		DELETE FROM guild_member WHERE server_id = $1 AND player_id = $2
		RETURNING guild_id
	`, serverID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotMember
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE guild SET member_count = GREATEST(member_count - 1, 0), updated_at = now()
		WHERE server_id = $1 AND guild_id = $2
	`, serverID, guildID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *PGStore) ListMembers(ctx context.Context, serverID int32, guildID int64, offset, limit int) ([]Member, int32, error) {
	var total int32
	err := p.Pool.QueryRow(ctx, `
		SELECT COUNT(1) FROM guild_member WHERE server_id = $1 AND guild_id = $2
	`, serverID, guildID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}
	if total == 0 {
		var n int
		err = p.Pool.QueryRow(ctx, `SELECT COUNT(1) FROM guild WHERE server_id = $1 AND guild_id = $2`, serverID, guildID).Scan(&n)
		if err != nil {
			return nil, 0, err
		}
		if n == 0 {
			return nil, 0, ErrNotFound
		}
		return nil, 0, nil
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, guild_id, player_id, role, joined_at
		FROM guild_member
		WHERE server_id = $1 AND guild_id = $2
		ORDER BY role ASC, joined_at ASC, player_id ASC
		OFFSET $3 LIMIT $4
	`, serverID, guildID, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ServerID, &m.GuildID, &m.PlayerID, &m.Role, &m.JoinedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, rows.Err()
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
