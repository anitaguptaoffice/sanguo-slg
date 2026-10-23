package guild

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
)

// ChatCoordinator delegates world/private chat to chat.Service and implements guild channel access.
type ChatCoordinator struct {
	guild   *Service
	chat    *chat.Service
	store   chat.Store
	players chat.PlayerDirectory
	limits chat.Limits
	now    func() time.Time
}

// NewChatCoordinator wires guild membership checks into chat send/list for the guild channel.
func NewChatCoordinator(guildSvc *Service, chatSvc *chat.Service, store chat.Store, players chat.PlayerDirectory) *ChatCoordinator {
	if store == nil {
		store = WrapChatStore(chat.NewMemStore())
	}
	lim := chat.DefaultSendLimits
	return &ChatCoordinator{
		guild:   guildSvc,
		chat:    chatSvc,
		store:   store,
		players: players,
		limits: lim,
		now:    time.Now,
	}
}

// SetClock overrides time (tests).
func (c *ChatCoordinator) SetClock(fn func() time.Time) {
	if fn != nil {
		c.now = fn
	}
}

// Send mirrors chat.Service.Send but handles guild channels with membership checks.
func (c *ChatCoordinator) Send(ctx context.Context, actor chat.Actor, req *chatv1.SendChatMessageRequest) (*chatv1.SendChatMessageResponse, error) {
	chType, err := chatProtoChannel(req.GetChannel())
	if err != nil {
		return nil, err
	}
	if chType != chat.ChannelTypeGuild {
		return c.chat.Send(ctx, actor, req)
	}
	return c.sendGuild(ctx, actor, req)
}

// List mirrors chat.Service.List but handles guild channels with membership checks.
func (c *ChatCoordinator) List(ctx context.Context, actor chat.Actor, req *chatv1.ListChatMessagesRequest) (*chatv1.ListChatMessagesResponse, error) {
	chType, err := chatProtoChannel(req.GetChannel())
	if err != nil {
		return nil, err
	}
	if chType != chat.ChannelTypeGuild {
		return c.chat.List(ctx, actor, req)
	}
	return c.listGuild(ctx, actor, req)
}

func (c *ChatCoordinator) sendGuild(ctx context.Context, actor chat.Actor, req *chatv1.SendChatMessageRequest) (*chatv1.SendChatMessageResponse, error) {
	if actor.PlayerID == 0 {
		return nil, chat.ErrUnauthorized
	}
	if req.GetServerId() != 0 && req.GetServerId() != actor.ServerID {
		return nil, chat.ErrWrongServer
	}
	serverID := actor.ServerID
	guildID := req.GetGuildId()
	if err := c.guild.RequireGuildMember(ctx, serverID, actor.PlayerID, guildID); err != nil {
		return nil, err
	}
	content := strings.TrimSpace(req.GetContent())
	if content == "" {
		return nil, chat.ErrEmptyContent
	}
	if int32(utf8.RuneCountInString(content)) > c.limits.MaxContentLength {
		return nil, chat.ErrContentTooLong
	}
	now := c.now()
	mutedUntilMS, err := c.store.MutedUntilMS(ctx, serverID, actor.PlayerID)
	if err != nil {
		return nil, err
	}
	if mutedUntilMS > now.UnixMilli() {
		return nil, chat.ErrPlayerMuted
	}
	channelID, err := EnsureGuildChannel(ctx, c.store, serverID, guildID)
	if err != nil {
		return nil, err
	}
	display := actor.DisplayName
	if display == "" && c.players != nil {
		display, _ = c.players.DisplayName(ctx, serverID, actor.PlayerID)
	}
	msg := chat.Message{
		ServerID:          serverID,
		ChannelID:         channelID,
		ChannelType:       chat.ChannelTypeGuild,
		SenderPlayerID:    actor.PlayerID,
		SenderDisplayName: display,
		GuildID:           guildID,
		Content:           content,
		CreatedAt:         now,
	}
	stored, err := c.store.InsertMessage(ctx, msg)
	if err != nil {
		return nil, err
	}
	return &chatv1.SendChatMessageResponse{
		Message:           stored.ToProto(),
		Limits:            c.limits.ToProto(),
		RemainingInWindow: c.limits.MaxMessagesPerWindow,
	}, nil
}

func (c *ChatCoordinator) listGuild(ctx context.Context, actor chat.Actor, req *chatv1.ListChatMessagesRequest) (*chatv1.ListChatMessagesResponse, error) {
	if actor.PlayerID == 0 {
		return nil, chat.ErrUnauthorized
	}
	if req.GetServerId() != 0 && req.GetServerId() != actor.ServerID {
		return nil, chat.ErrWrongServer
	}
	serverID := actor.ServerID
	guildID := req.GetGuildId()
	if err := c.guild.RequireGuildMember(ctx, serverID, actor.PlayerID, guildID); err != nil {
		return nil, err
	}
	channelID, err := EnsureGuildChannel(ctx, c.store, serverID, guildID)
	if err != nil {
		return nil, err
	}
	rows, err := c.store.ListMessages(ctx, chat.ListQuery{
		ServerID:        serverID,
		ChannelType:     chat.ChannelTypeGuild,
		ChannelID:       channelID,
		GuildID:         guildID,
		BeforeMessageID: req.GetBeforeMessageId(),
		Limit:           req.GetLimit(),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*chatv1.ChatMessage, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.ToProto())
	}
	return &chatv1.ListChatMessagesResponse{
		Messages: out,
		Limits:   c.limits.ToProto(),
	}, nil
}

func chatProtoChannel(ch chatv1.ChatChannel) (int16, error) {
	switch ch {
	case chatv1.ChatChannel_CHAT_CHANNEL_WORLD:
		return chat.ChannelTypeWorld, nil
	case chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE:
		return chat.ChannelTypePrivate, nil
	case chatv1.ChatChannel_CHAT_CHANNEL_GUILD:
		return chat.ChannelTypeGuild, nil
	default:
		return 0, chat.ErrInvalidChannel
	}
}
