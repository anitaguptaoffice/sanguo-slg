package guild

import (
	"context"
	"sync"
	"time"
)

// MemStore is an in-memory Store for unit tests and local wiring.
type MemStore struct {
	mu sync.Mutex

	nextGuildID map[int32]int64
	guilds      map[guildKey]Guild
	byName      map[nameKey]int64
	members     map[memberKey]Member
	byGuild     map[guildKey][]memberKey
}

type guildKey struct {
	serverID int32
	guildID  int64
}

type nameKey struct {
	serverID int32
	name     string
}

type memberKey struct {
	serverID int32
	playerID int64
}

// NewMemStore builds an empty guild store.
func NewMemStore() *MemStore {
	return &MemStore{
		nextGuildID: make(map[int32]int64),
		guilds:      make(map[guildKey]Guild),
		byName:      make(map[nameKey]int64),
		members:     make(map[memberKey]Member),
		byGuild:     make(map[guildKey][]memberKey),
	}
}

func (m *MemStore) CreateGuild(_ context.Context, g Guild, leader Member) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	nk := nameKey{serverID: g.ServerID, name: g.Name}
	if _, ok := m.byName[nk]; ok {
		return ErrNameTaken
	}
	mk := memberKey{serverID: leader.ServerID, playerID: leader.PlayerID}
	if _, ok := m.members[mk]; ok {
		return ErrAlreadyMember
	}
	if g.GuildID == 0 {
		m.nextGuildID[g.ServerID]++
		g.GuildID = m.nextGuildID[g.ServerID]
	}
	if g.MemberLimit <= 0 {
		g.MemberLimit = DefaultMemberLimit
	}
	if g.MemberCount == 0 {
		g.MemberCount = 1
	}
	if g.CreatedAt.IsZero() {
		g.CreatedAt = time.Now()
	}
	gk := guildKey{serverID: g.ServerID, guildID: g.GuildID}
	m.guilds[gk] = g
	m.byName[nk] = g.GuildID
	leader.GuildID = g.GuildID
	leader.ServerID = g.ServerID
	if leader.Role == 0 {
		leader.Role = RoleLeader
	}
	if leader.JoinedAt.IsZero() {
		leader.JoinedAt = g.CreatedAt
	}
	m.members[mk] = leader
	m.byGuild[gk] = []memberKey{mk}
	return nil
}

func (m *MemStore) GetGuild(_ context.Context, serverID int32, guildID int64) (Guild, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	g, ok := m.guilds[guildKey{serverID: serverID, guildID: guildID}]
	if !ok {
		return Guild{}, ErrNotFound
	}
	return g, nil
}

func (m *MemStore) GetMembership(_ context.Context, serverID int32, playerID int64) (Member, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	mem, ok := m.members[memberKey{serverID: serverID, playerID: playerID}]
	if !ok {
		return Member{}, ErrNotMember
	}
	return mem, nil
}

func (m *MemStore) AddMember(_ context.Context, serverID int32, guildID int64, member Member) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	gk := guildKey{serverID: serverID, guildID: guildID}
	g, ok := m.guilds[gk]
	if !ok {
		return ErrNotFound
	}
	limit := g.MemberLimit
	if limit <= 0 {
		limit = DefaultMemberLimit
	}
	if g.MemberCount >= limit {
		return ErrFull
	}
	mk := memberKey{serverID: serverID, playerID: member.PlayerID}
	if _, ok := m.members[mk]; ok {
		return ErrAlreadyMember
	}
	member.GuildID = guildID
	member.ServerID = serverID
	if member.Role == 0 {
		member.Role = RoleMember
	}
	if member.JoinedAt.IsZero() {
		member.JoinedAt = time.Now()
	}
	m.members[mk] = member
	m.byGuild[gk] = append(m.byGuild[gk], mk)
	g.MemberCount++
	m.guilds[gk] = g
	return nil
}

func (m *MemStore) RemoveMember(_ context.Context, serverID int32, playerID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	mk := memberKey{serverID: serverID, playerID: playerID}
	mem, ok := m.members[mk]
	if !ok {
		return ErrNotMember
	}
	gk := guildKey{serverID: serverID, guildID: mem.GuildID}
	g, ok := m.guilds[gk]
	if !ok {
		return ErrNotFound
	}
	delete(m.members, mk)
	keys := m.byGuild[gk]
	filtered := make([]memberKey, 0, len(keys))
	for _, k := range keys {
		if k != mk {
			filtered = append(filtered, k)
		}
	}
	m.byGuild[gk] = filtered
	if g.MemberCount > 0 {
		g.MemberCount--
	}
	m.guilds[gk] = g
	return nil
}

func (m *MemStore) ListMembers(_ context.Context, serverID int32, guildID int64, offset, limit int) ([]Member, int32, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	gk := guildKey{serverID: serverID, guildID: guildID}
	if _, ok := m.guilds[gk]; !ok {
		return nil, 0, ErrNotFound
	}
	keys := m.byGuild[gk]
	total := int32(len(keys))
	if offset < 0 {
		offset = 0
	}
	if offset >= len(keys) {
		return nil, total, nil
	}
	end := len(keys)
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	out := make([]Member, 0, end-offset)
	for _, k := range keys[offset:end] {
		out = append(out, m.members[k])
	}
	return out, total, nil
}
