package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestMilitaryGenerationCapture(t *testing.T) {
	b, p, c := returnSourceFixture(t)
	g, err := newMilitaryGeneration(b, p, c)
	if err != nil {
		t.Fatal(err)
	}
	r, v := g.s.children.recruit.s, g.s.children.returns.s
	if r.binding != v.binding || r.binding == b || r.admission != v.admission || r.admission != g.s.admission || r.admission.s.binding != r.binding {
		t.Fatal("source pointer or lifetime split")
	}
	if len(r.profile.Objects) != 34 || len(v.profile.Objects) != 43 || r.attempted || v.attempted || g.s.pair != nil {
		t.Fatal("constructor initialized or changed fixed inventory")
	}
	for _, names := range recruitSourceInventories() {
		for _, name := range names {
			if r.profile.Objects[name] != p.Objects[name] {
				t.Fatal("wrong recruit projection", name)
			}
		}
	}
	projected := r.profile
	projected.Objects = v.profile.Objects
	if !reflect.DeepEqual(projected, p) {
		t.Fatal("common profile metadata changed")
	}
	savedBinding, savedCatalog := *b, *c
	*b, *c = recruittx.Binding{}, march.RecruitCatalog{}
	delete(p.Objects, "account")
	p.ServerID = 99
	if *r.binding != savedBinding || len(v.profile.Objects) != 43 || len(r.profile.Objects) != 34 || r.profile.ServerID != 7 || v.profile.ServerID != 7 {
		t.Fatal("caller mutation escaped snapshot")
	}
	for unit := int32(1); unit <= 4; unit++ {
		want, _ := savedCatalog.Current(unit)
		for _, catalog := range []march.RecruitCatalog{r.catalog, v.catalog} {
			if got, err := catalog.Current(unit); err != nil || got != want {
				t.Fatal("catalog capture changed", err)
			}
		}
	}
}

func TestMilitaryGenerationRejectsInvalidCapture(t *testing.T) {
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "march_order") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 999, OwnerOID: 3} },
		func(p *freshsource.Profile) { p.Objects["account"] = p.Objects["march_order"] },
		func(p *freshsource.Profile) { p.ServerID = 0 },
	} {
		b, p, c := returnSourceFixture(t)
		change(&p)
		if g, err := newMilitaryGeneration(b, p, c); g != nil || err == nil {
			t.Fatal("invalid profile accepted")
		}
	}
	b, p, c := returnSourceFixture(t)
	for _, invalid := range []*recruittx.Binding{nil, {}} {
		if g, err := newMilitaryGeneration(invalid, p, c); g != nil || err == nil {
			t.Fatal("invalid binding accepted")
		}
	}
	for _, invalid := range []*march.RecruitCatalog{nil, {}} {
		if g, err := newMilitaryGeneration(b, p, invalid); g != nil || err == nil {
			t.Fatal("invalid catalog accepted")
		}
	}
}

func TestMilitaryGenerationOneShot(t *testing.T) {
	canceled, cancel := context.WithTimeout(context.Background(), time.Second)
	cancel()
	for _, ctx := range []context.Context{nil, context.Background(), canceled} {
		b, p, c := returnSourceFixture(t)
		g, _ := newMilitaryGeneration(b, p, c)
		alias := *g
		if pair, err := g.initialize(ctx); pair != nil || err == nil || ctx == canceled && !errors.Is(err, context.Canceled) {
			t.Fatal("invalid context accepted", err)
		}
		if pair, err := alias.initialize(context.Background()); pair != nil || err == nil {
			t.Fatal("copy retried initialization")
		}
		if !g.s.closed || !g.s.attempted || g.s.pair != nil || g.s.children.recruit.s.bundle != nil || g.s.children.returns.s.bundle != nil || !g.s.children.returns.s.closed || g.s.admission.s.pending != 0 {
			t.Fatal("failure retained child or lease")
		}
		if err := alias.waitDrained(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	for _, g := range []*militaryGeneration{nil, {}} {
		pair, err := g.initialize(context.Background())
		if pair != nil || err == nil || g.close() == nil || g.waitDrained(context.Background()) == nil {
			t.Fatal("invalid group accepted")
		}
	}
}

func TestMilitaryGenerationSharedDrain(t *testing.T) {
	for _, unknown := range []bool{false, true} {
		b, p, c := returnSourceFixture(t)
		g, _ := newMilitaryGeneration(b, p, c)
		alias := *g
		first, err := g.s.children.recruit.s.admission.acquire(context.Background())
		returnPGOK(t, err)
		second, err := g.s.children.returns.s.admission.acquire(context.Background())
		returnPGOK(t, err)
		returnPGOK(t, alias.close())
		returnPGOK(t, g.close())
		if _, err := g.s.admission.acquire(context.Background()); err == nil {
			t.Fatal("closed group admitted work")
		}
		if pair, err := g.initialize(context.Background()); pair != nil || err == nil {
			t.Fatal("closed group reopened")
		}
		returnPGOK(t, first.ended())
		ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
		if err := alias.waitDrained(ctx); !errors.Is(err, context.DeadlineExceeded) {
			t.Fatal("first child drained second", err)
		}
		cancel()
		if unknown {
			returnPGOK(t, second.unknown())
			_ = second.ended()
			returnPGOK(t, alias.close())
			ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
			if err := g.waitDrained(ctx); !errors.Is(err, context.DeadlineExceeded) || g.s.admission.s.pending != 1 {
				t.Fatal("unknown was resolved", err)
			}
			cancel()
		} else {
			returnPGOK(t, second.ended())
			returnPGOK(t, alias.waitDrained(context.Background()))
		}
	}
}
