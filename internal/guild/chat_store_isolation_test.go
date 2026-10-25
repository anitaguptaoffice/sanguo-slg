package guild

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
)

func TestWrappedChatStoreMemoryChannelIsolation(t *testing.T) {
	checkWrappedChatStoreIsolation(t, chat.NewMemStore())
}

func TestWrappedChatStorePGChannelIsolation(t *testing.T) {
	pool := openGuildTestDB(t)
	applyGuildSchema(t, pool)
	checkWrappedChatStoreIsolation(t, chat.NewPGStore(pool))
}

func checkWrappedChatStoreIsolation(t *testing.T, inner chat.Store) {
	t.Helper()
	ctx := context.Background()
	store := WrapChatStore(inner)
	world, err := store.EnsureWorldChannel(ctx, 9)
	if err != nil {
		t.Fatal(err)
	}
	guildA, err := store.EnsureGuildChannel(ctx, 9, 10)
	if err != nil {
		t.Fatal(err)
	}
	private, err := store.EnsurePrivateChannel(ctx, 9, 100, 101)
	if err != nil {
		t.Fatal(err)
	}
	guildB, err := store.EnsureGuildChannel(ctx, 9, 11)
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		id   int64
		kind int16
		text string
	}{
		{world, chat.ChannelTypeWorld, "world only"},
		{guildA, chat.ChannelTypeGuild, "guild A only"},
		{private, chat.ChannelTypePrivate, "private only"},
		{guildB, chat.ChannelTypeGuild, "guild B only"},
	}
	seen := map[int64]bool{}
	for _, c := range cases {
		if seen[c.id] {
			t.Fatalf("channel ID collision: %+v", cases)
		}
		seen[c.id] = true
		if _, err := store.InsertMessage(ctx, chat.Message{ServerID: 9, ChannelID: c.id, ChannelType: c.kind, SenderPlayerID: 100, Content: c.text, CreatedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	// Re-wrap the same durable/memory store in reverse guild order. IDs must not
	// depend on encounter order or reuse another channel after service rebuild.
	rebuilt := WrapChatStore(inner)
	for _, g := range []struct{ guild, channel int64 }{{11, guildB}, {10, guildA}} {
		id, err := rebuilt.EnsureGuildChannel(ctx, 9, g.guild)
		if err != nil || id != g.channel {
			t.Fatalf("rebuild guild=%d id=%d want=%d err=%v", g.guild, id, g.channel, err)
		}
	}
	for _, c := range cases {
		rows, err := rebuilt.ListMessages(ctx, chat.ListQuery{ServerID: 9, ChannelID: c.id, ChannelType: c.kind, Limit: 20})
		if err != nil || len(rows) != 1 || rows[0].Content != c.text {
			t.Fatalf("channel=%d rows=%+v err=%v", c.id, rows, err)
		}
	}
}

func TestWrappedChatStorePGConcurrentGuildAllocation(t *testing.T) {
	pool := openGuildTestDB(t)
	applyGuildSchema(t, pool)
	const n = 12
	type result struct {
		guild, id int64
		err       error
	}
	results := make(chan result, n)
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		go func(i int) {
			<-start
			gid := int64(i%4 + 1)
			id, err := WrapChatStore(chat.NewPGStore(pool)).EnsureGuildChannel(context.Background(), 9, gid)
			results <- result{gid, id, err}
		}(i)
	}
	close(start)
	ids := map[int64]int64{}
	owners := map[int64]int64{}
	for i := 0; i < n; i++ {
		r := <-results
		if r.err != nil {
			t.Fatal(r.err)
		}
		if id, ok := ids[r.guild]; ok && id != r.id {
			t.Fatalf("guild %d allocated twice: %d and %d", r.guild, id, r.id)
		}
		if gid, ok := owners[r.id]; ok && gid != r.guild {
			t.Fatalf("channel %d shared by guilds %d and %d", r.id, gid, r.guild)
		}
		ids[r.guild] = r.id
		owners[r.id] = r.guild
	}
	if len(ids) != 4 {
		t.Fatalf("guilds=%v", ids)
	}
}

func TestWrappedChatStoreGuildIdentityValidation(t *testing.T) {
	ctx := context.Background()
	store := WrapChatStore(chat.NewMemStore())
	for _, id := range []int64{0, -1} {
		if _, err := store.EnsureGuildChannel(ctx, 1, id); err != ErrGuildRequired {
			t.Fatalf("guild %d err=%v", id, err)
		}
	}
	a, _ := store.EnsureGuildChannel(ctx, 1, 1)
	b, _ := store.EnsureGuildChannel(ctx, 2, 1)
	for _, sid := range []int32{1, 2} {
		_, err := store.InsertMessage(ctx, chat.Message{ServerID: sid, ChannelID: a, ChannelType: chat.ChannelTypeGuild, Content: fmt.Sprint(sid)})
		if err != nil {
			t.Fatal(err)
		}
	}
	if a != b {
		t.Fatal("memory shard-local identities should be deterministic")
	}
	rows, err := store.ListMessages(ctx, chat.ListQuery{ServerID: 2, ChannelID: b, ChannelType: chat.ChannelTypeGuild})
	if err != nil || len(rows) != 1 || rows[0].Content != "2" {
		t.Fatalf("cross-shard leak rows=%v err=%v", rows, err)
	}
}
