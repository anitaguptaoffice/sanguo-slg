package chat

import (
	"context"
	"errors"
	"testing"
	"time"

	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
)

type stubPlayers struct {
	exists map[int64]bool
	names  map[int64]string
}

func (s stubPlayers) DisplayName(_ context.Context, _ int32, playerID int64) (string, error) {
	if s.names != nil {
		if n, ok := s.names[playerID]; ok {
			return n, nil
		}
	}
	return "player", nil
}

func (s stubPlayers) ExistsOnServer(_ context.Context, _ int32, playerID int64) (bool, error) {
	if s.exists == nil {
		return true, nil
	}
	return s.exists[playerID], nil
}

func TestWorldSendAndList(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, stubPlayers{})
	actor := Actor{ServerID: 1, PlayerID: 10, DisplayName: "Alice"}

	sendResp, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		ServerId: 1,
		Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content:  "hello world",
	})
	if err != nil {
		t.Fatal(err)
	}
	if sendResp.GetMessage().GetMessageId() == 0 {
		t.Fatal("expected message id")
	}

	listResp, err := svc.List(context.Background(), actor, &chatv1.ListChatMessagesRequest{
		ServerId: 1,
		Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(listResp.GetMessages()) != 1 || listResp.GetMessages()[0].GetContent() != "hello world" {
		t.Fatalf("messages=%v", listResp.GetMessages())
	}
}

func TestWrongServerRejected(t *testing.T) {
	svc := NewService(NewMemStore(), stubPlayers{})
	actor := Actor{ServerID: 1, PlayerID: 1, DisplayName: "A"}
	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		ServerId: 2,
		Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content:  "x",
	})
	if !errors.Is(err, ErrWrongServer) {
		t.Fatalf("err=%v", err)
	}
}

func TestContentLengthLimit(t *testing.T) {
	svc := NewService(NewMemStore(), stubPlayers{})
	lim := svc.limits.MaxContentLength
	long := make([]rune, lim+1)
	for i := range long {
		long[i] = 'a'
	}
	actor := Actor{ServerID: 1, PlayerID: 1}
	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: string(long),
	})
	if !errors.Is(err, ErrContentTooLong) {
		t.Fatalf("err=%v", err)
	}
}

func TestPrivateChatRequiresRecipientOnServer(t *testing.T) {
	players := stubPlayers{exists: map[int64]bool{99: true}}
	svc := NewService(NewMemStore(), players)
	actor := Actor{ServerID: 1, PlayerID: 1, DisplayName: "A"}

	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel:           chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE,
		Content:           "hi",
		RecipientPlayerId: 42,
	})
	if !errors.Is(err, ErrRecipientNotFound) {
		t.Fatalf("err=%v", err)
	}

	_, err = svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel:           chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE,
		Content:           "hi",
		RecipientPlayerId: 99,
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}

	peer := Actor{ServerID: 1, PlayerID: 99, DisplayName: "B"}
	list, err := svc.List(context.Background(), peer, &chatv1.ListChatMessagesRequest{
		Channel:      chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE,
		PeerPlayerId: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(list.GetMessages()) != 1 {
		t.Fatalf("got %d messages", len(list.GetMessages()))
	}
}

func TestRateLimit(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, stubPlayers{})
	now := time.Unix(1_700_000_000, 0)
	svc.SetClock(func() time.Time { return now })
	// tighten limits for test
	svc.limits.MinIntervalMS = 5000
	svc.limiter = newRateLimiter(svc.limits)

	actor := Actor{ServerID: 1, PlayerID: 7, DisplayName: "spammer"}
	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "one",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "two",
	})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("err=%v", err)
	}
}

func TestMutedPlayerCannotSend(t *testing.T) {
	store := NewMemStore()
	until := time.Now().Add(time.Hour).UnixMilli()
	if err := store.SetMutedUntilMS(context.Background(), 1, 10, until); err != nil {
		t.Fatal(err)
	}
	svc := NewService(store, stubPlayers{})
	actor := Actor{ServerID: 1, PlayerID: 10, DisplayName: "muted"}
	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "nope",
	})
	if !errors.Is(err, ErrPlayerMuted) {
		t.Fatalf("err=%v", err)
	}
}

func TestWorldBroadcastHook(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, stubPlayers{})
	var got int
	svc.SetWorldBroadcast(func(msg Message) { got++ })
	actor := Actor{ServerID: 1, PlayerID: 1, DisplayName: "A"}
	_, err := svc.Send(context.Background(), actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "ping",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got != 1 {
		t.Fatalf("broadcasts=%d", got)
	}
}
