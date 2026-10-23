package guild

import (
	"context"
	"errors"
	"testing"
	"time"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
)

type stubPlayers struct {
	names  map[int64]string
	powers map[int64]int64
}

func (s stubPlayers) DisplayName(_ context.Context, _ int32, playerID int64) (string, error) {
	if s.names != nil {
		if n, ok := s.names[playerID]; ok {
			return n, nil
		}
	}
	return "player", nil
}

func (s stubPlayers) PlayerPower(_ context.Context, _ int32, playerID int64) (int64, error) {
	if s.powers != nil {
		return s.powers[playerID], nil
	}
	return 0, nil
}

func TestCreateJoinLeaveFlow(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, stubPlayers{names: map[int64]string{1: "Leader", 2: "Member"}})
	leader := Actor{ServerID: 1, PlayerID: 1}

	createResp, err := svc.CreateGuild(context.Background(), leader, &guildv1.CreateGuildRequest{
		ServerId: 1,
		Name:     "蜀汉",
	})
	if err != nil {
		t.Fatal(err)
	}
	gid := createResp.GetGuild().GetGuildId()
	if gid == 0 || createResp.GetGuild().GetLeaderPlayerId() != 1 {
		t.Fatalf("guild=%v", createResp.GetGuild())
	}

	member := Actor{ServerID: 1, PlayerID: 2}
	joinResp, err := svc.JoinGuild(context.Background(), member, &guildv1.JoinGuildRequest{
		ServerId: 1,
		GuildId:  gid,
	})
	if err != nil || joinResp.GetGuild().GetMemberCount() != 2 {
		t.Fatalf("join err=%v guild=%v", err, joinResp.GetGuild())
	}

	_, err = svc.JoinGuild(context.Background(), member, &guildv1.JoinGuildRequest{ServerId: 1, GuildId: gid})
	if !errors.Is(err, ErrAlreadyMember) {
		t.Fatalf("duplicate join err=%v", err)
	}

	listResp, err := svc.ListGuildMembers(context.Background(), member, &guildv1.ListGuildMembersRequest{
		ServerId: 1,
		GuildId:  gid,
	})
	if err != nil || listResp.GetTotalCount() != 2 || len(listResp.GetMembers()) != 2 {
		t.Fatalf("list=%v err=%v", listResp, err)
	}
	if listResp.GetMembers()[0].GetRole() != guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_LEADER {
		t.Fatalf("expected leader first by role sort, got %v", listResp.GetMembers()[0])
	}

	_, err = svc.LeaveGuild(context.Background(), leader, &guildv1.LeaveGuildRequest{ServerId: 1})
	if !errors.Is(err, ErrLeaderCannotLeave) {
		t.Fatalf("leader leave err=%v", err)
	}

	_, err = svc.LeaveGuild(context.Background(), member, &guildv1.LeaveGuildRequest{ServerId: 1})
	if err != nil {
		t.Fatal(err)
	}
	g, _ := store.GetGuild(context.Background(), 1, gid)
	if g.MemberCount != 1 {
		t.Fatalf("count=%d", g.MemberCount)
	}
}

func TestServerIsolation(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, stubPlayers{})
	ctx := context.Background()

	resp, err := svc.CreateGuild(ctx, Actor{ServerID: 1, PlayerID: 10}, &guildv1.CreateGuildRequest{
		ServerId: 1, Name: "曹魏",
	})
	if err != nil {
		t.Fatal(err)
	}
	gid := resp.GetGuild().GetGuildId()

	_, err = svc.JoinGuild(ctx, Actor{ServerID: 2, PlayerID: 20}, &guildv1.JoinGuildRequest{
		ServerId: 2,
		GuildId:  gid,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-shard join err=%v", err)
	}

	_, err = svc.CreateGuild(ctx, Actor{ServerID: 2, PlayerID: 10}, &guildv1.CreateGuildRequest{
		ServerId: 2, Name: "曹魏",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.ListGuildMembers(ctx, Actor{ServerID: 2, PlayerID: 20}, &guildv1.ListGuildMembersRequest{
		ServerId: 2,
		GuildId:  99999,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing guild on shard err=%v", err)
	}

	_, err = svc.CreateGuild(ctx, Actor{ServerID: 1, PlayerID: 30}, &guildv1.CreateGuildRequest{
		ServerId: 2,
		Name:     "bad",
	})
	if !errors.Is(err, ErrWrongServer) {
		t.Fatalf("request server_id mismatch err=%v", err)
	}
}

func TestNameValidationAndWrongServer(t *testing.T) {
	svc := NewService(NewMemStore(), nil)
	actor := Actor{ServerID: 1, PlayerID: 1}

	_, err := svc.CreateGuild(context.Background(), actor, &guildv1.CreateGuildRequest{
		ServerId: 2,
		Name:     "ab",
	})
	if !errors.Is(err, ErrWrongServer) {
		t.Fatalf("wrong server err=%v", err)
	}

	_, err = svc.CreateGuild(context.Background(), actor, &guildv1.CreateGuildRequest{Name: "a"})
	if !errors.Is(err, ErrNameInvalid) {
		t.Fatalf("short name err=%v", err)
	}

	_, err = svc.CreateGuild(context.Background(), actor, &guildv1.CreateGuildRequest{Name: "valid"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.CreateGuild(context.Background(), Actor{ServerID: 1, PlayerID: 2}, &guildv1.CreateGuildRequest{Name: "valid"})
	if !errors.Is(err, ErrNameTaken) {
		t.Fatalf("name taken err=%v", err)
	}
}

func TestGuildFull(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, nil)
	ctx := context.Background()
	leader := Actor{ServerID: 1, PlayerID: 1}
	resp, err := svc.CreateGuild(ctx, leader, &guildv1.CreateGuildRequest{Name: "full"})
	if err != nil {
		t.Fatal(err)
	}
	gid := resp.GetGuild().GetGuildId()
	g, _ := store.GetGuild(ctx, 1, gid)
	g.MemberLimit = 2
	store.mu.Lock()
	store.guilds[guildKey{serverID: 1, guildID: gid}] = g
	store.mu.Unlock()

	_, err = svc.JoinGuild(ctx, Actor{ServerID: 1, PlayerID: 2}, &guildv1.JoinGuildRequest{GuildId: gid})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.JoinGuild(ctx, Actor{ServerID: 1, PlayerID: 3}, &guildv1.JoinGuildRequest{GuildId: gid})
	if !errors.Is(err, ErrFull) {
		t.Fatalf("full err=%v", err)
	}
}

func TestCreateSetsLeaderRole(t *testing.T) {
	store := NewMemStore()
	fixed := time.Unix(1_700_000_000, 0).UTC()
	svc := NewService(store, stubPlayers{powers: map[int64]int64{5: 999}})
	svc.SetClock(func() time.Time { return fixed })

	_, err := svc.CreateGuild(context.Background(), Actor{ServerID: 3, PlayerID: 5}, &guildv1.CreateGuildRequest{Name: "东吴"})
	if err != nil {
		t.Fatal(err)
	}
	mem, err := store.GetMembership(context.Background(), 3, 5)
	if err != nil || mem.Role != RoleLeader || !mem.JoinedAt.Equal(fixed) {
		t.Fatalf("membership %+v err=%v", mem, err)
	}
}
