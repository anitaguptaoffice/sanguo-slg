package gateway

import "context"

// SessionValidator checks ClientPacket.session_id after login.
type SessionValidator interface {
	Valid(ctx context.Context, sessionID string) bool
}

// AllowAllSessions is for tests only.
type AllowAllSessions struct{}

func (AllowAllSessions) Valid(context.Context, string) bool { return true }

// MapSessions backs validation with an in-memory set.
type MapSessions struct {
	IDs map[string]struct{}
}

func (m MapSessions) Valid(_ context.Context, sessionID string) bool {
	if sessionID == "" {
		return false
	}
	_, ok := m.IDs[sessionID]
	return ok
}
