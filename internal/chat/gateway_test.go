package chat

import (
	"context"
	"errors"
	"testing"
	"time"

	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

type mapSessions struct {
	actors map[string]Actor
}

func (m mapSessions) ActorForSession(_ context.Context, sessionID string) (Actor, error) {
	a, ok := m.actors[sessionID]
	if !ok {
		return Actor{}, ErrUnauthorized
	}
	return a, nil
}

func TestGatewaySendUnauthorized(t *testing.T) {
	svc := NewService(NewMemStore(), stubPlayers{})
	h := GatewayHandlers(svc, mapSessions{actors: map[string]Actor{}})[RouteSendChatMessage]
	resp, err := h(context.Background(), &commonv1.ClientPacket{
		Route:     RouteSendChatMessage,
		TraceId:   "t1",
		SessionId: "missing",
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
		t.Fatalf("code=%d", resp.Code)
	}
}

func TestGatewaySendPlayerMutedCode(t *testing.T) {
	store := NewMemStore()
	until := time.Now().Add(time.Hour).UnixMilli()
	if err := store.SetMutedUntilMS(context.Background(), 1, 1, until); err != nil {
		t.Fatal(err)
	}
	svc := NewService(store, stubPlayers{})
	sessions := mapSessions{actors: map[string]Actor{
		"s1": {ServerID: 1, PlayerID: 1, DisplayName: "A"},
	}}
	h := GatewayHandlers(svc, sessions)[RouteSendChatMessage]
	payload, _ := proto.Marshal(&chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "muted",
	})
	resp, err := h(context.Background(), &commonv1.ClientPacket{
		Route: RouteSendChatMessage, TraceId: "t", SessionId: "s1", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Code != int32(errCodeChatPlayerMuted) {
		t.Fatalf("code=%d msg=%s", resp.Code, resp.Msg)
	}
}

func TestGatewaySendRateLimitCode(t *testing.T) {
	svc := NewService(NewMemStore(), stubPlayers{})
	svc.limits.MinIntervalMS = 60_000
	svc.limiter = newRateLimiter(svc.limits)
	sessions := mapSessions{actors: map[string]Actor{
		"s1": {ServerID: 1, PlayerID: 1, DisplayName: "A"},
	}}
	h := GatewayHandlers(svc, sessions)[RouteSendChatMessage]
	payload, _ := proto.Marshal(&chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "a",
	})
	_, err := h(context.Background(), &commonv1.ClientPacket{
		Route: RouteSendChatMessage, TraceId: "t", SessionId: "s1", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	resp, err := h(context.Background(), &commonv1.ClientPacket{
		Route: RouteSendChatMessage, TraceId: "t", SessionId: "s1", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Code != int32(errCodeChatRateLimited) {
		t.Fatalf("code=%d msg=%s", resp.Code, resp.Msg)
	}
}

func TestGatewayListRoundTrip(t *testing.T) {
	svc := NewService(NewMemStore(), stubPlayers{})
	sessions := mapSessions{actors: map[string]Actor{
		"s1": {ServerID: 1, PlayerID: 2, DisplayName: "B"},
	}}
	handlers := GatewayHandlers(svc, sessions)
	sendPayload, _ := proto.Marshal(&chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "wire",
	})
	sendResp, err := handlers[RouteSendChatMessage](context.Background(), &commonv1.ClientPacket{
		Route: RouteSendChatMessage, SessionId: "s1", Payload: sendPayload,
	})
	if err != nil || sendResp.Code != 0 {
		t.Fatalf("send code=%d err=%v", sendResp.Code, err)
	}

	listPayload, _ := proto.Marshal(&chatv1.ListChatMessagesRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
	})
	listResp, err := handlers[RouteListChatMessages](context.Background(), &commonv1.ClientPacket{
		Route: RouteListChatMessages, SessionId: "s1", Payload: listPayload,
	})
	if err != nil || listResp.Code != 0 {
		t.Fatalf("list code=%d err=%v", listResp.Code, err)
	}
	var out chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.GetMessages()) != 1 {
		t.Fatalf("messages=%d", len(out.GetMessages()))
	}
}

func TestSessionResolverUnauthorized(t *testing.T) {
	sessions := mapSessions{actors: map[string]Actor{}}
	_, err := sessions.ActorForSession(context.Background(), "x")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatal(err)
	}
}
