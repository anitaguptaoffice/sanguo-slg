package chat

import (
	"context"
	"testing"
	"time"
)

func TestMemStoreContract(t *testing.T) {
	runChatStoreContract(t, NewMemStore())
}

func TestPGStoreContract(t *testing.T) {
	pool := openChatTestDB(t)
	ctx := context.Background()
	applyChatSchema(t, pool)
	runChatStoreContract(t, NewPGStore(pool))
	if err := assertChatReload(ctx, t, NewPGStore(pool)); err != nil {
		t.Fatal(err)
	}
}

func runChatStoreContract(t *testing.T, store Store) {
	ctx := context.Background()
	serverID := int32(1)
	now := time.Unix(1_700_000_300, 0).UTC()

	worldID, err := store.EnsureWorldChannel(ctx, serverID)
	if err != nil || worldID == 0 {
		t.Fatalf("world channel: id=%d err=%v", worldID, err)
	}
	privID, err := store.EnsurePrivateChannel(ctx, serverID, 10, 20)
	if err != nil || privID == 0 {
		t.Fatalf("private channel: id=%d err=%v", privID, err)
	}
	privAgain, err := store.EnsurePrivateChannel(ctx, serverID, 20, 10)
	if err != nil || privAgain != privID {
		t.Fatalf("private pair normalize: %d vs %d err=%v", privAgain, privID, err)
	}

	worldMsg, err := store.InsertMessage(ctx, Message{
		ServerID: serverID, ChannelID: worldID, ChannelType: ChannelTypeWorld,
		SenderPlayerID: 10, Content: "world hi", CreatedAt: now,
	})
	if err != nil || worldMsg.MessageID == 0 {
		t.Fatalf("world insert: %+v err=%v", worldMsg, err)
	}
	privMsg, err := store.InsertMessage(ctx, Message{
		ServerID: serverID, ChannelID: privID, ChannelType: ChannelTypePrivate,
		SenderPlayerID: 10, Content: "dm", CreatedAt: now.Add(time.Second),
	})
	if err != nil || privMsg.MessageID == 0 {
		t.Fatalf("private insert: %+v err=%v", privMsg, err)
	}

	worldRows, err := store.ListMessages(ctx, ListQuery{
		ServerID: serverID, ChannelType: ChannelTypeWorld, ChannelID: worldID,
	})
	if err != nil || len(worldRows) != 1 || worldRows[0].Content != "world hi" {
		t.Fatalf("world list: %+v err=%v", worldRows, err)
	}
	privRows, err := store.ListMessages(ctx, ListQuery{
		ServerID: serverID, ChannelType: ChannelTypePrivate, ChannelID: privID,
	})
	if err != nil || len(privRows) != 1 {
		t.Fatalf("private list: %+v err=%v", privRows, err)
	}

	untilMS := now.Add(2 * time.Hour).UnixMilli()
	if err := store.SetMutedUntilMS(ctx, serverID, 10, untilMS); err != nil {
		t.Fatal(err)
	}
	got, err := store.MutedUntilMS(ctx, serverID, 10)
	if err != nil || got != untilMS {
		t.Fatalf("mute until: got=%d want=%d err=%v", got, untilMS, err)
	}
	if err := store.SetMutedUntilMS(ctx, serverID, 10, 0); err != nil {
		t.Fatal(err)
	}
	got, err = store.MutedUntilMS(ctx, serverID, 10)
	if err != nil || got != 0 {
		t.Fatalf("unmute: got=%d err=%v", got, err)
	}
}

func assertChatReload(ctx context.Context, t *testing.T, store Store) error {
	t.Helper()
	worldID, err := store.EnsureWorldChannel(ctx, 1)
	if err != nil {
		return err
	}
	rows, err := store.ListMessages(ctx, ListQuery{
		ServerID: 1, ChannelType: ChannelTypeWorld, ChannelID: worldID,
	})
	if err != nil {
		return err
	}
	if len(rows) != 1 || rows[0].Content != "world hi" {
		t.Fatalf("reload world messages: %+v", rows)
	}
	privID, err := store.EnsurePrivateChannel(ctx, 1, 10, 20)
	if err != nil {
		return err
	}
	privRows, err := store.ListMessages(ctx, ListQuery{
		ServerID: 1, ChannelType: ChannelTypePrivate, ChannelID: privID,
	})
	if err != nil {
		return err
	}
	if len(privRows) != 1 {
		t.Fatalf("reload private messages: %+v", privRows)
	}
	return nil
}
