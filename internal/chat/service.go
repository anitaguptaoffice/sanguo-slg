package chat

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
)

// WorldBroadcastFunc is invoked after a world message is stored (optional gateway push).
type WorldBroadcastFunc func(msg Message)

// Service implements send/list for world and private channels.
type Service struct {
	store     Store
	players   PlayerDirectory
	limits    Limits
	limiter   *rateLimiter
	now       func() time.Time
	onWorld   WorldBroadcastFunc
}

// NewService wires dependencies. players may be nil only in tests that skip private chat.
func NewService(store Store, players PlayerDirectory) *Service {
	lim := DefaultSendLimits
	return &Service{
		store:   store,
		players: players,
		limits:  lim,
		limiter: newRateLimiter(lim),
		now:     time.Now,
	}
}

// SetClock overrides time (tests).
func (s *Service) SetClock(fn func() time.Time) {
	if fn != nil {
		s.now = fn
	}
}

// SetWorldBroadcast registers a hook for world-channel fan-out.
func (s *Service) SetWorldBroadcast(fn WorldBroadcastFunc) {
	s.onWorld = fn
}

// LimitsProto exposes active send limits.
func (s *Service) LimitsProto() *chatv1.ChatSendLimits {
	return s.limits.ToProto()
}

// Send stores a chat message for the authenticated actor.
func (s *Service) Send(ctx context.Context, actor Actor, req *chatv1.SendChatMessageRequest) (*chatv1.SendChatMessageResponse, error) {
	if actor.PlayerID == 0 {
		return nil, ErrUnauthorized
	}
	if req.GetServerId() != 0 && req.GetServerId() != actor.ServerID {
		return nil, ErrWrongServer
	}
	serverID := actor.ServerID
	chType, err := protoChannel(req.GetChannel())
	if err != nil {
		return nil, err
	}
	content := strings.TrimSpace(req.GetContent())
	if content == "" {
		return nil, ErrEmptyContent
	}
	if int32(utf8.RuneCountInString(content)) > s.limits.MaxContentLength {
		return nil, ErrContentTooLong
	}

	now := s.now()
	mutedUntilMS, err := s.store.MutedUntilMS(ctx, serverID, actor.PlayerID)
	if err != nil {
		return nil, err
	}
	if mutedUntilMS > now.UnixMilli() {
		return nil, ErrPlayerMuted
	}

	var channelID int64
	var recipientID int64
	var guildID int64

	switch chType {
	case ChannelTypeWorld:
		channelID, err = s.store.EnsureWorldChannel(ctx, serverID)
	case ChannelTypePrivate:
		recipientID = req.GetRecipientPlayerId()
		if recipientID == 0 {
			return nil, ErrRecipientRequired
		}
		if recipientID == actor.PlayerID {
			return nil, ErrCannotMessageSelf
		}
		if s.players == nil {
			return nil, ErrRecipientNotFound
		}
		ok, existErr := s.players.ExistsOnServer(ctx, serverID, recipientID)
		if existErr != nil {
			return nil, existErr
		}
		if !ok {
			return nil, ErrRecipientNotFound
		}
		channelID, err = s.store.EnsurePrivateChannel(ctx, serverID, actor.PlayerID, recipientID)
	case ChannelTypeGuild:
		return nil, ErrGuildNotSupported
	default:
		return nil, ErrInvalidChannel
	}
	if err != nil {
		return nil, err
	}

	rk := rateKey{serverID: serverID, playerID: actor.PlayerID, channelType: chType, channelID: channelID}
	dec := s.limiter.check(rk, now)
	if !dec.Allowed {
		return nil, ErrRateLimited
	}

	display := actor.DisplayName
	if display == "" && s.players != nil {
		display, _ = s.players.DisplayName(ctx, serverID, actor.PlayerID)
	}

	msg := Message{
		ServerID:          serverID,
		ChannelID:         channelID,
		ChannelType:       chType,
		SenderPlayerID:    actor.PlayerID,
		SenderDisplayName: display,
		RecipientPlayerID: recipientID,
		GuildID:           guildID,
		Content:           content,
		CreatedAt:         now,
	}
	stored, err := s.store.InsertMessage(ctx, msg)
	if err != nil {
		return nil, err
	}
	s.limiter.record(rk, now)

	decAfter := s.limiter.check(rk, now)
	remaining := decAfter.RemainingInWindow
	if remaining < 0 {
		remaining = 0
	}

	if chType == ChannelTypeWorld && s.onWorld != nil {
		s.onWorld(stored)
	}

	return &chatv1.SendChatMessageResponse{
		Message:           stored.ToProto(),
		Limits:            s.limits.ToProto(),
		RemainingInWindow: remaining,
		NextAllowedAtMs:   decAfter.NextAllowedAtMS,
	}, nil
}

// List returns recent messages visible to the actor.
func (s *Service) List(ctx context.Context, actor Actor, req *chatv1.ListChatMessagesRequest) (*chatv1.ListChatMessagesResponse, error) {
	if actor.PlayerID == 0 {
		return nil, ErrUnauthorized
	}
	if req.GetServerId() != 0 && req.GetServerId() != actor.ServerID {
		return nil, ErrWrongServer
	}
	serverID := actor.ServerID
	chType, err := protoChannel(req.GetChannel())
	if err != nil {
		return nil, err
	}

	var channelID int64
	switch chType {
	case ChannelTypeWorld:
		channelID, err = s.store.EnsureWorldChannel(ctx, serverID)
	case ChannelTypePrivate:
		peer := req.GetPeerPlayerId()
		if peer == 0 {
			return nil, ErrRecipientRequired
		}
		channelID, err = s.store.EnsurePrivateChannel(ctx, serverID, actor.PlayerID, peer)
	case ChannelTypeGuild:
		return nil, ErrGuildNotSupported
	default:
		return nil, ErrInvalidChannel
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.store.ListMessages(ctx, ListQuery{
		ServerID:        serverID,
		ChannelType:     chType,
		ChannelID:       channelID,
		GuildID:         req.GetGuildId(),
		PeerPlayerID:    req.GetPeerPlayerId(),
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
		Limits:   s.limits.ToProto(),
	}, nil
}
