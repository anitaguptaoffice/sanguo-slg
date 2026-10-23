package guild

import (
	"context"
	"testing"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
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

func TestGatewayCreateNameTakenCode(t *testing.T) {
	svc := NewService(NewMemStore(), nil)
	sessions := mapSessions{actors: map[string]Actor{
		"s1": {ServerID: 1, PlayerID: 1},
		"s2": {ServerID: 1, PlayerID: 2},
	}}
	handlers := GatewayHandlers(svc, sessions)

	payload, _ := proto.Marshal(&guildv1.CreateGuildRequest{Name: "dup"})
	_, _ = handlers[RouteCreateGuild](context.Background(), &commonv1.ClientPacket{
		Route: RouteCreateGuild, TraceId: "t", SessionId: "s1", Payload: payload,
	})
	resp, err := handlers[RouteCreateGuild](context.Background(), &commonv1.ClientPacket{
		Route: RouteCreateGuild, TraceId: "t", SessionId: "s2", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.GetCode() != int32(commonv1.ErrorCode_GUILD_NAME_TAKEN) {
		t.Fatalf("code=%d", resp.GetCode())
	}
}

func TestGatewayUnauthorized(t *testing.T) {
	svc := NewService(NewMemStore(), nil)
	h := GatewayHandlers(svc, mapSessions{actors: map[string]Actor{}})[RouteJoinGuild]
	resp, err := h(context.Background(), &commonv1.ClientPacket{
		Route: RouteJoinGuild, TraceId: "t", SessionId: "missing",
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
		t.Fatalf("code=%d", resp.GetCode())
	}
}
