package mail

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// MemStore is an in-memory Store for unit tests.
type MemStore struct {
	mu      sync.Mutex
	seq     map[int32]int64
	byKey   map[string]Mail
}

// NewMemStore creates an empty mem store.
func NewMemStore() *MemStore {
	return &MemStore{
		seq:   make(map[int32]int64),
		byKey: make(map[string]Mail),
	}
}

func mailKey(serverID int32, mailID int64) string {
	return fmt.Sprintf("%d:%d", serverID, mailID)
}

func (m *MemStore) NextMailID(_ context.Context, serverID int32) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seq[serverID]++
	return m.seq[serverID], nil
}

func (m *MemStore) Insert(_ context.Context, row Mail) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.byKey[mailKey(row.ServerID, row.MailID)] = row
	return nil
}

func (m *MemStore) Get(_ context.Context, serverID int32, mailID int64) (Mail, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	row, ok := m.byKey[mailKey(serverID, mailID)]
	return row, ok, nil
}

func (m *MemStore) ListInbox(_ context.Context, serverID int32, playerID int64, q ListQuery) (ListResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var matches []Mail
	for _, row := range m.byKey {
		if row.ServerID != serverID || row.PlayerID != playerID || row.Status == StatusDeleted {
			continue
		}
		switch q.Filter {
		case FilterUnread:
			if row.Status != StatusUnread {
				continue
			}
		case FilterRead:
			if row.Status != StatusRead && row.Status != StatusClaimed {
				continue
			}
		}
		matches = append(matches, row)
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].CreatedAt.After(matches[j].CreatedAt)
	})
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	total := len(matches)
	if q.Offset > len(matches) {
		return ListResult{Mails: nil, Total: total}, nil
	}
	end := q.Offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	page := matches[q.Offset:end]
	return ListResult{Mails: page, Total: total}, nil
}

func (m *MemStore) MarkRead(_ context.Context, serverID int32, playerID int64, mailID int64) (Mail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := mailKey(serverID, mailID)
	row, ok := m.byKey[key]
	if !ok {
		return Mail{}, ErrNotFound
	}
	if row.PlayerID != playerID {
		return Mail{}, ErrForbidden
	}
	if row.Status == StatusDeleted {
		return Mail{}, ErrAlreadyDeleted
	}
	if row.Status == StatusUnread {
		now := time.Now()
		row.Status = StatusRead
		row.ReadAt = &now
		m.byKey[key] = row
	}
	return row, nil
}

func (m *MemStore) MarkClaimed(_ context.Context, serverID int32, playerID int64, mailID int64) (Mail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := mailKey(serverID, mailID)
	row, ok := m.byKey[key]
	if !ok {
		return Mail{}, ErrNotFound
	}
	if row.PlayerID != playerID {
		return Mail{}, ErrForbidden
	}
	if row.Status == StatusDeleted {
		return Mail{}, ErrAlreadyDeleted
	}
	now := time.Now()
	if row.ReadAt == nil {
		row.ReadAt = &now
	}
	row.Status = StatusClaimed
	row.ClaimedAt = &now
	m.byKey[key] = row
	return row, nil
}
