package guild

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// guildChatStore decorates chat.Store with per-guild channel allocation (m3_003 ref_id=guild_id).
type guildChatStore struct {
	inner chat.Store
}

// WrapChatStore returns a chat.Store that supports EnsureGuildChannel via EnsureGuildChannel.
func WrapChatStore(inner chat.Store) *guildChatStore {
	return &guildChatStore{inner: inner}
}

func (g *guildChatStore) EnsureWorldChannel(ctx context.Context, serverID int32) (int64, error) {
	return g.inner.EnsureWorldChannel(ctx, serverID)
}

func (g *guildChatStore) EnsurePrivateChannel(ctx context.Context, serverID int32, playerA, playerB int64) (int64, error) {
	return g.inner.EnsurePrivateChannel(ctx, serverID, playerA, playerB)
}

func (g *guildChatStore) InsertMessage(ctx context.Context, msg chat.Message) (chat.Message, error) {
	return g.inner.InsertMessage(ctx, msg)
}

func (g *guildChatStore) ListMessages(ctx context.Context, q chat.ListQuery) ([]chat.Message, error) {
	return g.inner.ListMessages(ctx, q)
}

func (g *guildChatStore) SetMutedUntilMS(ctx context.Context, serverID int32, playerID int64, untilMS int64) error {
	return g.inner.SetMutedUntilMS(ctx, serverID, playerID, untilMS)
}

func (g *guildChatStore) MutedUntilMS(ctx context.Context, serverID int32, playerID int64) (int64, error) {
	return g.inner.MutedUntilMS(ctx, serverID, playerID)
}

func (g *guildChatStore) EnsureGuildChannel(ctx context.Context, serverID int32, guildID int64) (int64, error) {
	if guildID <= 0 {
		return 0, ErrGuildRequired
	}
	switch inner := g.inner.(type) {
	case *chat.PGStore:
		return ensureGuildChannelPG(ctx, inner.Pool, serverID, guildID)
	case *chat.MemStore:
		// MemStore allocates world/private IDs upwards from 1. Guild IDs are
		// positive, so their negation is disjoint and stable across wrappers.
		// This synthetic namespace is memory-only; PG always resolves real rows.
		return -guildID, nil
	default:
		return 0, ErrChatStoreUnsupported
	}
}

// EnsureGuildChannel resolves or creates the chat channel row for a legion.
func EnsureGuildChannel(ctx context.Context, store chat.Store, serverID int32, guildID int64) (int64, error) {
	if guildID <= 0 {
		return 0, ErrGuildRequired
	}
	if wrapped, ok := store.(*guildChatStore); ok {
		return wrapped.EnsureGuildChannel(ctx, serverID, guildID)
	}
	if pg, ok := store.(*chat.PGStore); ok {
		return ensureGuildChannelPG(ctx, pg.Pool, serverID, guildID)
	}
	return 0, ErrChatStoreUnsupported
}

func ensureGuildChannelPG(ctx context.Context, pool *pgxpool.Pool, serverID int32, guildID int64) (int64, error) {
	for attempt := 0; attempt < 16; attempt++ {
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		var id int64
		err := pool.QueryRow(ctx, `SELECT channel_id FROM chat_channel
   WHERE server_id=$1 AND channel_type=$2 AND ref_id=$3`,
			serverID, chat.ChannelTypeGuild, guildID).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
		// Both the per-server channel key and per-guild identity are unique.
		// A concurrent world/private/guild allocation may win either key; retry
		// resolution rather than reuse its ID or surface a transient collision.
		err = pool.QueryRow(ctx, `INSERT INTO chat_channel
   (server_id, channel_id, channel_type, ref_id)
   SELECT $1, COALESCE(MAX(channel_id),0)+1, $2, $3
   FROM chat_channel WHERE server_id=$1
   ON CONFLICT DO NOTHING RETURNING channel_id`,
			serverID, chat.ChannelTypeGuild, guildID).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
	}
	return 0, ErrChatChannelBusy
}
