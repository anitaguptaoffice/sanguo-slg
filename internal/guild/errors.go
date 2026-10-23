package guild

import "errors"

var (
	ErrUnauthorized        = errors.New("guild: unauthorized")
	ErrWrongServer         = errors.New("guild: server_id mismatch")
	ErrNotFound            = errors.New("guild: not found")
	ErrAlreadyMember       = errors.New("guild: already in a guild")
	ErrNotMember           = errors.New("guild: not a member")
	ErrNameInvalid         = errors.New("guild: name invalid")
	ErrNameTaken           = errors.New("guild: name taken")
	ErrFull                = errors.New("guild: full")
	ErrLeaderCannotLeave   = errors.New("guild: leader must transfer or disband first")
	ErrPermissionDenied    = errors.New("guild: permission denied")
)
