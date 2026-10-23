package gateway

import (
	"sync"
)

// hub tracks live connections for caps and session reconnect (single session per ID).
type hub struct {
	mu           sync.Mutex
	count        int
	max          int
	bySession map[string]*conn
}

func newHub(max int) *hub {
	return &hub{max: max, bySession: make(map[string]*conn)}
}

func (h *hub) tryAdd() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.max > 0 && h.count >= h.max {
		return false
	}
	h.count++
	return true
}

func (h *hub) remove() {
	h.mu.Lock()
	h.count--
	h.mu.Unlock()
}

func (h *hub) bindSession(sessionID string, c *conn) {
	if sessionID == "" {
		return
	}
	h.mu.Lock()
	if old, ok := h.bySession[sessionID]; ok && old != c {
		old.closeWithReason("replaced by reconnect")
	}
	h.bySession[sessionID] = c
	h.mu.Unlock()
}

func (h *hub) unbindSession(sessionID string, c *conn) {
	if sessionID == "" {
		return
	}
	h.mu.Lock()
	if cur, ok := h.bySession[sessionID]; ok && cur == c {
		delete(h.bySession, sessionID)
	}
	h.mu.Unlock()
}

func (h *hub) connectionCount() int {
	h.mu.Lock()
	n := h.count
	h.mu.Unlock()
	return n
}
