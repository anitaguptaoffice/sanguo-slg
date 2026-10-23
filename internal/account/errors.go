package account

import "errors"

var (
	ErrLoginFailed        = errors.New("login failed")
	ErrBanned             = errors.New("account banned")
	ErrServerNotFound     = errors.New("server not found")
	ErrServerUnavailable  = errors.New("server unavailable")
	ErrNoPlayer           = errors.New("no player on server")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrInvalidRequest     = errors.New("invalid request")
)
