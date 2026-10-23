package chat

import (
	"time"

	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
)

// Storage channel_type values (spec/db/m3_003_chat.sql).
const (
	ChannelTypeWorld   int16 = 1
	ChannelTypeGuild   int16 = 2
	ChannelTypePrivate int16 = 3
)

// DefaultSendLimits matches DDL content cap and conservative anti-spam defaults.
var DefaultSendLimits = Limits{
	MaxContentLength:     500,
	MinIntervalMS:        1000,
	MaxMessagesPerWindow: 20,
	WindowMS:             60_000,
}

// Limits mirrors proto ChatSendLimits.
type Limits struct {
	MaxContentLength     int32
	MinIntervalMS        int32
	MaxMessagesPerWindow int32
	WindowMS             int32
}

func (l Limits) ToProto() *chatv1.ChatSendLimits {
	return &chatv1.ChatSendLimits{
		MaxContentLength:     l.MaxContentLength,
		MinIntervalMs:        l.MinIntervalMS,
		MaxMessagesPerWindow: l.MaxMessagesPerWindow,
		WindowMs:             l.WindowMS,
	}
}

// Message is one row in chat_message plus routing metadata for API mapping.
type Message struct {
	ServerID            int32
	ChannelID           int64
	MessageID           int64
	ChannelType         int16
	SenderPlayerID      int64
	SenderDisplayName   string
	RecipientPlayerID   int64
	GuildID             int64
	Content             string
	CreatedAt           time.Time
	PeerPlayerID        int64 // normalized other party for private list display
}

// ListQuery loads recent messages for a channel instance.
type ListQuery struct {
	ServerID        int32
	ChannelType     int16
	ChannelID       int64
	GuildID         int64
	PeerPlayerID    int64
	BeforeMessageID int64
	Limit           int32
}

// Actor is the authenticated player sending or listing chat.
type Actor struct {
	ServerID    int32
	PlayerID    int64
	DisplayName string
}

func protoChannel(ch chatv1.ChatChannel) (int16, error) {
	switch ch {
	case chatv1.ChatChannel_CHAT_CHANNEL_WORLD:
		return ChannelTypeWorld, nil
	case chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE:
		return ChannelTypePrivate, nil
	case chatv1.ChatChannel_CHAT_CHANNEL_GUILD:
		return ChannelTypeGuild, nil
	default:
		return 0, ErrInvalidChannel
	}
}

func channelToProto(t int16) chatv1.ChatChannel {
	switch t {
	case ChannelTypeWorld:
		return chatv1.ChatChannel_CHAT_CHANNEL_WORLD
	case ChannelTypePrivate:
		return chatv1.ChatChannel_CHAT_CHANNEL_PRIVATE
	case ChannelTypeGuild:
		return chatv1.ChatChannel_CHAT_CHANNEL_GUILD
	default:
		return chatv1.ChatChannel_CHAT_CHANNEL_UNSPECIFIED
	}
}

func (m Message) ToProto() *chatv1.ChatMessage {
	out := &chatv1.ChatMessage{
		MessageId:           m.MessageID,
		ServerId:            m.ServerID,
		Channel:             channelToProto(m.ChannelType),
		SenderPlayerId:      m.SenderPlayerID,
		SenderDisplayName:   m.SenderDisplayName,
		RecipientPlayerId:   m.RecipientPlayerID,
		GuildId:             m.GuildID,
		Content:             m.Content,
		SentAtMs:            m.CreatedAt.UnixMilli(),
	}
	return out
}

func privatePair(a, b int64) (low, high int64) {
	if a < b {
		return a, b
	}
	return b, a
}
