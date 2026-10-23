package rank

import (
	"context"
	"fmt"
	"sync"
)

// MemStore is an in-memory Store for unit tests.
type MemStore struct {
	mu       sync.Mutex
	headers  map[string]SnapshotMeta
	entries  map[string][]Entry
	latest   map[string]int64 // server:type -> batch_id
	nextBatch map[string]int64
}

// NewMemStore creates an empty store.
func NewMemStore() *MemStore {
	return &MemStore{
		headers:   make(map[string]SnapshotMeta),
		entries:   make(map[string][]Entry),
		latest:    make(map[string]int64),
		nextBatch: make(map[string]int64),
	}
}

func typeKey(serverID int32, rankType RankType) string {
	return fmt.Sprintf("%d:%d", serverID, rankType)
}

func batchKey(serverID int32, rankType RankType, batchID int64) string {
	return fmt.Sprintf("%d:%d:%d", serverID, rankType, batchID)
}

func (m *MemStore) WriteSnapshot(_ context.Context, meta SnapshotMeta, entries []Entry) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	tk := typeKey(meta.ServerID, meta.RankType)
	if meta.BatchID == 0 {
		meta.BatchID = m.nextBatch[tk] + 1
		m.nextBatch[tk] = meta.BatchID
	}
	bk := batchKey(meta.ServerID, meta.RankType, meta.BatchID)
	meta.EntryCount = int32(len(entries))
	m.headers[bk] = meta
	m.entries[bk] = append([]Entry(nil), entries...)
	m.latest[tk] = meta.BatchID
	return nil
}

func (m *MemStore) LatestSnapshot(_ context.Context, serverID int32, rankType RankType) (SnapshotMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	tk := typeKey(serverID, rankType)
	bid := m.latest[tk]
	if bid == 0 {
		return SnapshotMeta{}, ErrNoSnapshot
	}
	meta, ok := m.headers[batchKey(serverID, rankType, bid)]
	if !ok {
		return SnapshotMeta{}, ErrNoSnapshot
	}
	return meta, nil
}

func (m *MemStore) ListEntries(_ context.Context, serverID int32, rankType RankType, batchID int64, offset, limit int) ([]Entry, int32, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := m.entries[batchKey(serverID, rankType, batchID)]
	total := int32(len(rows))
	if offset < 0 {
		offset = 0
	}
	if offset >= len(rows) {
		return nil, total, nil
	}
	end := len(rows)
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	return append([]Entry(nil), rows[offset:end]...), total, nil
}

func (m *MemStore) LookupSubject(_ context.Context, serverID int32, rankType RankType, batchID int64, subjectID int64) (int32, int64, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range m.entries[batchKey(serverID, rankType, batchID)] {
		if e.SubjectID == subjectID {
			return e.Position, e.Score, true, nil
		}
	}
	return 0, 0, false, nil
}
