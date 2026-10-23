package api

import (
	"sync"
)

// PlayerContext is bound to an account session after login or EnterGameServer.
// All gameplay handlers must use ServerID from this context (单服写边界见 internal/platform/shard/doc.go).
type PlayerContext struct {
	AccountID int64
	ServerID  int32
	PlayerID  int64
}

// SessionRegistry maps gateway session_id to the active shard player.
type SessionRegistry struct {
	mu   sync.RWMutex
	byID map[string]PlayerContext
}

func NewSessionRegistry() *SessionRegistry {
	return &SessionRegistry{byID: make(map[string]PlayerContext)}
}

func (r *SessionRegistry) Bind(sessionID string, pc PlayerContext) {
	if sessionID == "" {
		return
	}
	r.mu.Lock()
	r.byID[sessionID] = pc
	r.mu.Unlock()
}

func (r *SessionRegistry) Get(sessionID string) (PlayerContext, bool) {
	r.mu.RLock()
	pc, ok := r.byID[sessionID]
	r.mu.RUnlock()
	return pc, ok
}
