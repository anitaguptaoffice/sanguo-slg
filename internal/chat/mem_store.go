package chat

import (
	"context"
	"sort"
	"sync"
)

// MemStore is an in-memory implementation aligned with m3_003_chat.sql.
type MemStore struct {
	mu sync.Mutex

	nextChannelID map[int32]int64
	nextMessageID map[channelKey]int64

	worldChannel map[int32]int64 // server_id -> channel_id

	privateByPair map[privateKey]int64
	privateMeta   map[channelKey]privateKey

	messages map[channelKey][]Message
}

type channelKey struct {
	serverID  int32
	channelID int64
}

type privateKey struct {
	serverID int32
	low      int64
	high     int64
}

// NewMemStore builds an empty chat store.
func NewMemStore() *MemStore {
	return &MemStore{
		nextChannelID: make(map[int32]int64),
		nextMessageID: make(map[channelKey]int64),
		worldChannel:  make(map[int32]int64),
		privateByPair: make(map[privateKey]int64),
		privateMeta:   make(map[channelKey]privateKey),
		messages:      make(map[channelKey][]Message),
	}
}

func (m *MemStore) allocChannelID(serverID int32) int64 {
	m.nextChannelID[serverID]++
	return m.nextChannelID[serverID]
}

func (m *MemStore) allocMessageID(key channelKey) int64 {
	m.nextMessageID[key]++
	return m.nextMessageID[key]
}

func (m *MemStore) EnsureWorldChannel(_ context.Context, serverID int32) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id, ok := m.worldChannel[serverID]; ok {
		return id, nil
	}
	id := m.allocChannelID(serverID)
	m.worldChannel[serverID] = id
	return id, nil
}

func (m *MemStore) EnsurePrivateChannel(_ context.Context, serverID int32, playerA, playerB int64) (int64, error) {
	low, high := privatePair(playerA, playerB)
	key := privateKey{serverID: serverID, low: low, high: high}
	m.mu.Lock()
	defer m.mu.Unlock()
	if id, ok := m.privateByPair[key]; ok {
		return id, nil
	}
	id := m.allocChannelID(serverID)
	m.privateByPair[key] = id
	m.privateMeta[channelKey{serverID: serverID, channelID: id}] = key
	return id, nil
}

func (m *MemStore) InsertMessage(_ context.Context, msg Message) (Message, error) {
	key := channelKey{serverID: msg.ServerID, channelID: msg.ChannelID}
	m.mu.Lock()
	defer m.mu.Unlock()
	if msg.MessageID == 0 {
		msg.MessageID = m.allocMessageID(key)
	}
	cp := msg
	m.messages[key] = append(m.messages[key], cp)
	return cp, nil
}

func (m *MemStore) ListMessages(_ context.Context, q ListQuery) ([]Message, error) {
	key := channelKey{serverID: q.ServerID, channelID: q.ChannelID}
	limit := q.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	m.mu.Lock()
	raw := append([]Message(nil), m.messages[key]...)
	m.mu.Unlock()

	sort.Slice(raw, func(i, j int) bool {
		return raw[i].MessageID > raw[j].MessageID
	})
	if q.BeforeMessageID > 0 {
		filtered := make([]Message, 0, len(raw))
		for _, msg := range raw {
			if msg.MessageID < q.BeforeMessageID {
				filtered = append(filtered, msg)
			}
		}
		raw = filtered
	}
	if len(raw) > int(limit) {
		raw = raw[:limit]
	}
	sort.Slice(raw, func(i, j int) bool {
		return raw[i].MessageID < raw[j].MessageID
	})
	return raw, nil
}
