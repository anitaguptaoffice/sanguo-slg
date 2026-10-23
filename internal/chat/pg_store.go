package chat

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists chat per spec/db/m3_003_chat.sql.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) EnsureWorldChannel(ctx context.Context, serverID int32) (int64, error) {
	var id int64
	err := p.Pool.QueryRow(ctx, `
		SELECT channel_id FROM chat_channel
		WHERE server_id = $1 AND channel_type = $2
	`, serverID, ChannelTypeWorld).Scan(&id)
	if err == nil {
		return id, nil
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(channel_id), 0) + 1 FROM chat_channel WHERE server_id = $1
	`, serverID).Scan(&id); err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO chat_channel (server_id, channel_id, channel_type, ref_id)
		VALUES ($1, $2, $3, 0)
		ON CONFLICT DO NOTHING
	`, serverID, id, ChannelTypeWorld)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return p.EnsureWorldChannel(ctx, serverID)
}

func (p *PGStore) EnsurePrivateChannel(ctx context.Context, serverID int32, playerA, playerB int64) (int64, error) {
	low, high := privatePair(playerA, playerB)
	var id int64
	err := p.Pool.QueryRow(ctx, `
		SELECT channel_id FROM chat_private_pair
		WHERE server_id = $1 AND player_low_id = $2 AND player_high_id = $3
	`, serverID, low, high).Scan(&id)
	if err == nil {
		return id, nil
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(channel_id), 0) + 1 FROM chat_channel WHERE server_id = $1
	`, serverID).Scan(&id); err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO chat_channel (server_id, channel_id, channel_type, ref_id)
		VALUES ($1, $2, $3, 0)
	`, serverID, id, ChannelTypePrivate)
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO chat_private_pair (server_id, channel_id, player_low_id, player_high_id)
		VALUES ($1, $2, $3, $4)
	`, serverID, id, low, high)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

func (p *PGStore) InsertMessage(ctx context.Context, msg Message) (Message, error) {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return Message{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var mid int64
	if msg.MessageID == 0 {
		if err := tx.QueryRow(ctx, `
			SELECT COALESCE(MAX(message_id), 0) + 1 FROM chat_message
			WHERE server_id = $1 AND channel_id = $2
		`, msg.ServerID, msg.ChannelID).Scan(&mid); err != nil {
			return Message{}, err
		}
		msg.MessageID = mid
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO chat_message (server_id, channel_id, message_id, sender_player_id, content, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, msg.ServerID, msg.ChannelID, msg.MessageID, msg.SenderPlayerID, msg.Content, msg.CreatedAt)
	if err != nil {
		return Message{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Message{}, err
	}
	return msg, nil
}

func (p *PGStore) ListMessages(ctx context.Context, q ListQuery) ([]Message, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	query := `
		SELECT message_id, sender_player_id, content, created_at
		FROM chat_message
		WHERE server_id = $1 AND channel_id = $2
	`
	args := []any{q.ServerID, q.ChannelID}
	if q.BeforeMessageID > 0 {
		query += ` AND message_id < $3`
		args = append(args, q.BeforeMessageID)
	}
	query += fmt.Sprintf(` ORDER BY message_id DESC LIMIT %d`, limit)
	rows, err := p.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		m.ServerID = q.ServerID
		m.ChannelID = q.ChannelID
		m.ChannelType = q.ChannelType
		if err := rows.Scan(&m.MessageID, &m.SenderPlayerID, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// return ascending for clients
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}
