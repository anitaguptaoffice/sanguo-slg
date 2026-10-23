package guild

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

type mapChatSessions struct {
	actors map[string]chat.Actor
}

func (m mapChatSessions) ActorForSession(_ context.Context, sessionID string) (chat.Actor, error) {
	a, ok := m.actors[sessionID]
	if !ok {
		return chat.Actor{}, chat.ErrUnauthorized
	}
	return a, nil
}

type stubChatPlayers struct {
	names map[int64]string
}

func (s stubChatPlayers) DisplayName(_ context.Context, _ int32, playerID int64) (string, error) {
	if s.names != nil {
		return s.names[playerID], nil
	}
	return "", nil
}

func (s stubChatPlayers) ExistsOnServer(_ context.Context, _ int32, playerID int64) (bool, error) {
	return playerID > 0, nil
}

func TestGuildChatMemberSendList(t *testing.T) {
	gStore := NewMemStore()
	chatStore := WrapChatStore(chat.NewMemStore())
	guildSvc := NewService(gStore, stubPlayers{names: map[int64]string{1: "A", 2: "B"}})
	chatSvc := chat.NewService(chatStore, stubChatPlayers{names: map[int64]string{1: "A", 2: "B"}})
	coord := NewChatCoordinator(guildSvc, chatSvc, chatStore, stubChatPlayers{names: map[int64]string{1: "A", 2: "B"}})
	ctx := context.Background()

	leader := Actor{ServerID: 1, PlayerID: 1}
	resp, err := guildSvc.CreateGuild(ctx, leader, &guildv1.CreateGuildRequest{Name: "GuildA"})
	if err != nil {
		t.Fatal(err)
	}
	gid := resp.GetGuild().GetGuildId()
	_, err = guildSvc.JoinGuild(ctx, Actor{ServerID: 1, PlayerID: 2}, &guildv1.JoinGuildRequest{GuildId: gid})
	if err != nil {
		t.Fatal(err)
	}

	actor := chat.Actor{ServerID: 1, PlayerID: 1, DisplayName: "A"}
	sendOut, err := coord.Send(ctx, actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
		GuildId: gid,
		Content: "legion hello",
	})
	if err != nil {
		t.Fatal(err)
	}
	if sendOut.GetMessage().GetGuildId() != gid || sendOut.GetMessage().GetContent() != "legion hello" {
		t.Fatalf("send=%v", sendOut.GetMessage())
	}

	listOut, err := coord.List(ctx, chat.Actor{ServerID: 1, PlayerID: 2}, &chatv1.ListChatMessagesRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
		GuildId: gid,
	})
	if err != nil || len(listOut.GetMessages()) != 1 {
		t.Fatalf("list err=%v n=%d", err, len(listOut.GetMessages()))
	}
}

func TestGuildChatNonMemberForbidden(t *testing.T) {
	gStore := NewMemStore()
	chatStore := WrapChatStore(chat.NewMemStore())
	guildSvc := NewService(gStore, nil)
	chatSvc := chat.NewService(chatStore, nil)
	coord := NewChatCoordinator(guildSvc, chatSvc, chatStore, nil)
	ctx := context.Background()

	resp, err := guildSvc.CreateGuild(ctx, Actor{ServerID: 1, PlayerID: 1}, &guildv1.CreateGuildRequest{Name: "GuildB"})
	if err != nil {
		t.Fatal(err)
	}
	gid := resp.GetGuild().GetGuildId()

	_, err = coord.Send(ctx, chat.Actor{ServerID: 1, PlayerID: 99}, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
		GuildId: gid,
		Content: "nope",
	})
	if !errors.Is(err, chat.ErrChannelForbidden) {
		t.Fatalf("send err=%v", err)
	}

	_, err = coord.List(ctx, chat.Actor{ServerID: 1, PlayerID: 99}, &chatv1.ListChatMessagesRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
		GuildId: gid,
	})
	if !errors.Is(err, chat.ErrChannelForbidden) {
		t.Fatalf("list err=%v", err)
	}
}

func TestGuildChatGatewayGuildRequiredCode(t *testing.T) {
	gStore := NewMemStore()
	chatStore := WrapChatStore(chat.NewMemStore())
	guildSvc := NewService(gStore, nil)
	chatSvc := chat.NewService(chatStore, nil)
	coord := NewChatCoordinator(guildSvc, chatSvc, chatStore, nil)
	ctx := context.Background()
	_, err := guildSvc.CreateGuild(ctx, Actor{ServerID: 1, PlayerID: 1}, &guildv1.CreateGuildRequest{Name: "GuildC"})
	if err != nil {
		t.Fatal(err)
	}

	h := ChatGatewayHandlers(coord, mapChatSessions{actors: map[string]chat.Actor{
		"s1": {ServerID: 1, PlayerID: 1},
	}})[RouteSendChatMessage]
	payload, _ := proto.Marshal(&chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
		Content: "hi",
	})
	resp, err := h(ctx, &commonv1.ClientPacket{
		Route: RouteSendChatMessage, TraceId: "t", SessionId: "s1", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.GetCode() != int32(errCodeChatGuildRequired) {
		t.Fatalf("code=%d msg=%s", resp.GetCode(), resp.GetMsg())
	}
}
