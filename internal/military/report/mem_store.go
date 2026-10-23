package report

import (
	"context"
	"fmt"
	"sort"
	"sync"
)

// MemStore is an in-memory Store for unit tests.
type MemStore struct {
	mu   sync.Mutex
	rows map[string]Record
}

// NewMemStore creates an empty in-memory report store.
func NewMemStore() *MemStore {
	return &MemStore{rows: make(map[string]Record)}
}

func memKey(serverID int32, reportID int64) string {
	return fmt.Sprintf("%d:%d", serverID, reportID)
}

func (m *MemStore) Insert(_ context.Context, rec Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := memKey(rec.ServerID, rec.ReportID)
	if _, ok := m.rows[k]; ok {
		return ErrDuplicate
	}
	m.rows[k] = rec
	return nil
}

func (m *MemStore) Get(_ context.Context, serverID int32, reportID int64) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.rows[memKey(serverID, reportID)]
	if !ok {
		return Record{}, ErrNotFound
	}
	return rec, nil
}

func (m *MemStore) ListByPlayer(_ context.Context, p ListParams) (Page, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var matches []Record
	for _, rec := range m.rows {
		if rec.ServerID != p.ServerID {
			continue
		}
		if rec.AttackerPlayerID != p.PlayerID && (!rec.HasDefenderPlayer || rec.DefenderPlayerID != p.PlayerID) {
			continue
		}
		matches = append(matches, rec)
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].CreatedAt.After(matches[j].CreatedAt)
	})
	total := len(matches)
	start := p.Offset
	if start > total {
		start = total
	}
	end := start + p.Limit
	if p.Limit <= 0 {
		end = total
	} else if end > total {
		end = total
	}
	return Page{
		Items:  append([]Record(nil), matches[start:end]...),
		Total:  total,
		Limit:  p.Limit,
		Offset: p.Offset,
	}, nil
}
