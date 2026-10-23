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

func (r *SessionRegistry) Remove(sessionID string) {
	if sessionID == "" {
		return
	}
	r.mu.Lock()
	delete(r.byID, sessionID)
	r.mu.Unlock()
}

// SessionIDsForPlayer lists gateway session IDs bound to a shard player.
func (r *SessionRegistry) SessionIDsForPlayer(serverID int32, playerID int64) []string {
	r.mu.RLock()
	var out []string
	for sid, pc := range r.byID {
		if pc.ServerID == serverID && pc.PlayerID == playerID {
			out = append(out, sid)
		}
	}
	r.mu.RUnlock()
	return out
}

// IsPlayerOnline reports whether any session is bound to the player on the shard.
func (r *SessionRegistry) IsPlayerOnline(serverID int32, playerID int64) bool {
	return len(r.SessionIDsForPlayer(serverID, playerID)) > 0
}
