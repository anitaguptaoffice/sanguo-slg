package guild

import (
	"context"
	"errors"
	"testing"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
)

func TestKickAndSetRolePermissions(t *testing.T) {
	store := NewMemStore()
	svc := NewService(store, nil)
	ctx := context.Background()

	created, err := svc.CreateGuild(ctx, Actor{ServerID: 1, PlayerID: 1}, &guildv1.CreateGuildRequest{Name: "汉室"})
	if err != nil {
		t.Fatal(err)
	}
	gid := created.GetGuild().GetGuildId()
	_, err = svc.JoinGuild(ctx, Actor{ServerID: 1, PlayerID: 2}, &guildv1.JoinGuildRequest{GuildId: gid})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.JoinGuild(ctx, Actor{ServerID: 1, PlayerID: 3}, &guildv1.JoinGuildRequest{GuildId: gid})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.UpdateMemberRole(ctx, 1, gid, 3, RoleOfficer); err != nil {
		t.Fatal(err)
	}

	if err := svc.KickMember(ctx, Actor{ServerID: 1, PlayerID: 2}, 1); !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("member kick leader err=%v", err)
	}
	if err := svc.KickMember(ctx, Actor{ServerID: 1, PlayerID: 3}, 1); !errors.Is(err, ErrCannotKickLeader) {
		t.Fatalf("officer kick leader err=%v", err)
	}
	if err := svc.KickMember(ctx, Actor{ServerID: 1, PlayerID: 3}, 2); err != nil {
		t.Fatalf("officer kick member err=%v", err)
	}
	if err := svc.SetMemberRole(ctx, Actor{ServerID: 1, PlayerID: 3}, 3, RoleOfficer); !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("officer set role err=%v", err)
	}
	if err := svc.SetMemberRole(ctx, Actor{ServerID: 1, PlayerID: 1}, 3, RoleOfficer); err != nil {
		t.Fatalf("leader set role err=%v", err)
	}
	mem, err := store.GetMembership(ctx, 1, 3)
	if err != nil || mem.Role != RoleOfficer {
		t.Fatalf("role=%d err=%v", mem.Role, err)
	}
}
