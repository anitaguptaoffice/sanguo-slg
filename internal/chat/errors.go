package chat

import "errors"

var (
	ErrUnauthorized          = errors.New("chat: unauthorized")
	ErrWrongServer           = errors.New("chat: server_id mismatch")
	ErrInvalidChannel        = errors.New("chat: invalid channel")
	ErrChannelForbidden      = errors.New("chat: channel forbidden")
	ErrEmptyContent          = errors.New("chat: content empty")
	ErrContentTooLong        = errors.New("chat: content too long")
	ErrRateLimited           = errors.New("chat: rate limited")
	ErrRecipientRequired     = errors.New("chat: recipient required")
	ErrRecipientNotFound     = errors.New("chat: recipient not found")
	ErrCannotMessageSelf     = errors.New("chat: cannot message self")
	ErrGuildNotSupported     = errors.New("chat: guild channel not supported yet")
	ErrPlayerMuted           = errors.New("chat: player muted")
)
