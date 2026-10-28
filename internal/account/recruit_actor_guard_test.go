package account

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"testing"
)

func guardProfile() freshsource.Profile {
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "c", EvidenceRef: "e", DatabaseName: "d", SchemaName: "s", CurrentRoleName: "r", SessionRoleName: "r", DatabaseOID: 1, SchemaOID: 2, SchemaOwnerOID: 3, CurrentRoleOID: 4, SessionRoleOID: 4, ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	for i, name := range freshActorGuardNames {
		p.Objects[name] = freshsource.ObjectIdentity{OID: uint32(10 + i), OwnerOID: 3}
	}
	return p
}
func TestRecruitActorGuardInvalidInputs(t *testing.T) {
	p, ctx := guardProfile(), context.Background()
	zero := p
	zero.ServerID = 0
	for _, tc := range []struct {
		ctx context.Context
		b   *recruittx.Binding
		a   *recruittx.Access
		p   freshsource.Profile
	}{{nil, nil, nil, p}, {ctx, nil, nil, p}, {ctx, &recruittx.Binding{}, nil, p}, {ctx, nil, &recruittx.Access{}, p}, {ctx, &recruittx.Binding{}, &recruittx.Access{}, freshsource.Profile{}}, {ctx, &recruittx.Binding{}, &recruittx.Access{}, zero}} {
		if g, err := NewRecruitActorGuard(tc.ctx, tc.b, tc.a, tc.p); err == nil || g != nil {
			t.Fatal("malformed construction accepted")
		}
	}
	for _, name := range freshActorGuardNames {
		bad, _ := freshsource.Snapshot(p)
		delete(bad.Objects, name)
		if g, err := NewRecruitActorGuard(ctx, &recruittx.Binding{}, &recruittx.Access{}, bad); err == nil || g != nil {
			t.Fatal("missing projection accepted", name)
		}
	}
	extra, _ := freshsource.Snapshot(p)
	extra.Objects["extra"] = freshsource.ObjectIdentity{OID: 99, OwnerOID: 3}
	duplicate, _ := freshsource.Snapshot(p)
	duplicate.Objects["player"] = duplicate.Objects["account"]
	for _, profile := range []freshsource.Profile{extra, duplicate} {
		if g, err := NewRecruitActorGuard(ctx, &recruittx.Binding{}, &recruittx.Access{}, profile); err == nil || g != nil {
			t.Fatal("extra or duplicate projection accepted")
		}
	}
	retired := &recruitActorState{binding: &recruittx.Binding{}}
	retired.retired.Store(true)
	copied := RecruitActorGuard{s: retired}
	for _, g := range []*RecruitActorGuard{nil, {}, &copied} {
		if g.Pin(ctx, &recruittx.Access{}) == nil || g.Lock(ctx, &recruittx.Access{}, 1, 1) == nil {
			t.Fatal("zero or retired guard accepted")
		}
	}
	if (&RecruitActorGuard{s: &recruitActorState{binding: &recruittx.Binding{}}}).Lock(ctx, &recruittx.Access{}, 1, 1) == nil {
		t.Fatal("lock without pin accepted")
	}
}
