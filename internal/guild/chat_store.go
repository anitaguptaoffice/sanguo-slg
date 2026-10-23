package guild

import (
	"context"
	"sync"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	"github.com/jackc/pgx/v5/pgxpool"
)

// guildChatStore decorates chat.Store with per-guild channel allocation (m3_003 ref_id=guild_id).
type guildChatStore struct {
	inner chat.Store

	mu          sync.Mutex
	nextChannel map[int32]int64
	guildChan   map[guildChannelKey]int64
}

type guildChannelKey struct {
	serverID int32
	guildID  int64
}

// WrapChatStore returns a chat.Store that supports EnsureGuildChannel via EnsureGuildChannel.
func WrapChatStore(inner chat.Store) *guildChatStore {
	return &guildChatStore{
		inner:       inner,
		nextChannel: make(map[int32]int64),
		guildChan:   make(map[guildChannelKey]int64),
	}
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

func (g *guildChatStore) EnsureGuildChannel(_ context.Context, serverID int32, guildID int64) (int64, error) {
	if guildID == 0 {
		return 0, ErrGuildRequired
	}
	key := guildChannelKey{serverID: serverID, guildID: guildID}
	g.mu.Lock()
	defer g.mu.Unlock()
	if id, ok := g.guildChan[key]; ok {
		return id, nil
	}
	g.nextChannel[serverID]++
	id := g.nextChannel[serverID]
	g.guildChan[key] = id
	return id, nil
}

// EnsureGuildChannel resolves or creates the chat channel row for a legion.
func EnsureGuildChannel(ctx context.Context, store chat.Store, serverID int32, guildID int64) (int64, error) {
	if guildID == 0 {
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
	var id int64
	err := pool.QueryRow(ctx, `
		SELECT channel_id FROM chat_channel
		WHERE server_id = $1 AND channel_type = $2 AND ref_id = $3
	`, serverID, chat.ChannelTypeGuild, guildID).Scan(&id)
	if err == nil {
		return id, nil
	}
	tx, err := pool.Begin(ctx)
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
		VALUES ($1, $2, $3, $4)
	`, serverID, id, chat.ChannelTypeGuild, guildID)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return ensureGuildChannelPG(ctx, pool, serverID, guildID)
}
