package domestic

import (
	"bytes"
	"context"
	"maps"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// A second independently constructed TEST startup, never a runtime rebind route.
// Fields are fixed once before the actual constructor; no UseStore or fake source.
func freshTemplateSourcePGStartup(t *testing.T, ctx context.Context, f *freshSourcePG, catalog map[int32]BuildingSpec) *FreshCityParticipant {
	t.Helper()
	hub := NewHub(nil)
	hub.store, hub.serverID, hub.cat = NewPGStore(f.pool), f.profile.ServerID, maps.Clone(catalog)
	if !hub.SupportsAtomicCityCreation(f.pool, f.profile.ServerID) {
		t.Fatal("fixture startup lacks same-pool/shard correspondence")
	}
	o, a := recruitWalletBegin(t, ctx, f.binding)
	p, err := NewFreshCityParticipant(ctx, f.binding, a, f.profile, hub)
	if err != nil {
		t.Fatal("real constructor", err)
	}
	if err := o.Commit(ctx); err != nil {
		t.Fatal("caller cannot end startup", err)
	}
	return p
}

func freshTemplateSourcePGUnchanged(t *testing.T, ctx context.Context, f *freshSourcePG, a *recruittx.Access, before string) {
	t.Helper()
	if after := freshSourcePGSettings(t, ctx, f, a); before != after {
		t.Fatal("data methods changed transaction settings")
	}
	var assigned bool
	if err := a.Scan(ctx, f.binding, `SELECT pg_catalog.pg_current_xact_id_if_assigned() IS NOT NULL`, nil, &assigned); err != nil || assigned {
		t.Fatal("data methods assigned a transaction ID", err)
	}
	pid := freshSourcePGPID(t, ctx, f, a)
	if locks := freshSourcePGLocks(t, ctx, f, pid, "", true); locks != 0 {
		t.Fatal("data methods retained relation locks", locks)
	}
}

func TestPGFreshTemplateSourceDataOnly(t *testing.T) {
	for _, tc := range []struct {
		name   string
		quoted bool
	}{{"ordinary", false}, {"quoted", true}} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, tc.quoted)
			freshCatalogPGExec(t, ctx, f.pool, `
INSERT INTO player_wallet VALUES(1,9,123,456,789,234,567,'2026-01-02T00:00:00Z');
INSERT INTO city_building VALUES(1,7,'hall',3,2,NULL);
INSERT INTO city_production_checkpoint VALUES(1,7,9,'2026-01-02T00:00:00Z',999,11,22,33,44);
INSERT INTO player_research VALUES(1,9,8,2);
INSERT INTO work_queue VALUES(1,4,9,7,1,'{"fixture":true}','2026-01-02T00:00:00Z','2026-01-03T00:00:00Z',0);`)
			rows := freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)
			o, a := recruitWalletBegin(t, ctx, f.binding)
			settings := freshSourcePGSettings(t, ctx, f, a)
			initial, versions := freshTemplateSourceInput()
			content, err := f.source.CaptureTemplate(initial, versions)
			if err != nil {
				t.Fatal(err)
			}
			for _, v := range freshCodecVectors(t) {
				if v.Name == "current-default" && !reflect.DeepEqual(content, freshCodecContent(t, v)) {
					t.Fatal("real constructor capture differs from literal current-default")
				}
			}
			alias := *f.source
			first, err := alias.RestoreTemplate(content, 9)
			if err != nil || first.Wallet != initial.Wallet || first.PlayerID != 9 {
				t.Fatal("restore", err)
			}
			first.Buildings["hall"].Level++
			second, err := f.source.RestoreTemplate(content, 10)
			if err != nil || second.Buildings["hall"].Level != 1 || second.PlayerID != 10 {
				t.Fatal("aliased state", err)
			}
			bad := content
			bad.SHA256[0] ^= 1
			if got, err := f.source.RestoreTemplate(bad, 9); err == nil || got != nil {
				t.Fatal("bad digest admitted")
			}
			if got, err := f.source.RestoreTemplate(content, 0); err == nil || got != nil {
				t.Fatal("invalid player admitted")
			}
			freshTemplateSourcePGUnchanged(t, ctx, f, a, settings)
			if err := o.Commit(ctx); err != nil {
				t.Fatal("data method ended caller transaction", err)
			}
			if !reflect.DeepEqual(rows, freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)) || len(f.hub.cities) != 0 {
				t.Fatal("data operation changed wallet/gold/rows or published cache")
			}
			o, a = recruitWalletBegin(t, ctx, f.binding)
			freshSourcePGPin(t, ctx, f.source, a)
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			if got, err := alias.RestoreTemplate(content, 11); err != nil || got.PlayerID != 11 {
				t.Fatal("normal transaction ending retired source", err)
			}
		})
	}
}

func TestPGFreshTemplateSourceNoHubGate(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	initial, versions := freshTemplateSourceInput()
	type result struct {
		content FreshTemplateContent
		city    *CityState
		err     error
	}
	done := make(chan result, 1)
	f.hub.mu.Lock()
	go func() {
		content, err := f.source.CaptureTemplate(initial, versions)
		var city *CityState
		if err == nil {
			city, err = f.source.RestoreTemplate(content, 7)
		}
		done <- result{content, city, err}
	}()
	select {
	case r := <-done:
		f.hub.mu.Unlock()
		if r.err != nil || r.city == nil || ValidateFreshTemplateContent(r.content) != nil {
			t.Fatal("data operation", r.err)
		}
	case <-ctx.Done():
		f.hub.mu.Unlock()
		t.Fatal("data method waited for Hub gate", ctx.Err())
	}
}

func TestPGFreshTemplateSourceReleaseCatalog(t *testing.T) {
	for name, change := range freshTemplateSourceCatalogChanges() {
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, false)
			initial, versions := freshTemplateSourceInput()
			old, err := f.source.CaptureTemplate(initial, versions)
			if err != nil {
				t.Fatal(err)
			}
			retained := bytes.Clone(old.Bytes)
			catalog := maps.Clone(f.hub.cat)
			change(catalog)
			newSource := freshTemplateSourcePGStartup(t, ctx, f, catalog)
			delete(catalog, 1) // Input supplied to the test startup was itself copied.
			rows := freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)
			if ValidateFreshTemplateContent(old) != nil {
				t.Fatal("old bytes no longer parse")
			}
			if got, err := newSource.RestoreTemplate(old, 8); err == nil || got != nil {
				t.Fatal("unused catalog difference admitted")
			}
			versions.CatalogVersion = "catalog-2"
			current, err := newSource.CaptureTemplate(initial, versions)
			if err != nil || bytes.Equal(current.Bytes, old.Bytes) {
				t.Fatal("new constructor lost catalog change", err)
			}
			if got, err := newSource.RestoreTemplate(current, 9); err != nil || got.PlayerID != 9 {
				t.Fatal("matching release rejected", err)
			}
			if got, err := f.source.RestoreTemplate(old, 10); err != nil || got.PlayerID != 10 {
				t.Fatal("old capture was replaced", err)
			}
			if newSource.state.retired.Load() || !bytes.Equal(retained, old.Bytes) || len(newSource.state.hub.cities) != 0 ||
				!reflect.DeepEqual(rows, freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)) {
				t.Fatal("catalog rejection mutated source, data, rows or cache")
			}
		})
	}
}

func TestPGFreshTemplateSourceRetainedData(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	initial, versions := freshTemplateSourceInput()
	old, err := f.source.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	newSource := freshTemplateSourcePGStartup(t, ctx, f, f.hub.cat)
	initial.Wallet = Resources{1, 2, 3, 4}
	initial.Buildings["hall"].Level = 5
	versions.TemplateVersion, versions.RulesVersion = "template-2", "rules-2"
	current, err := newSource.CaptureTemplate(initial, versions)
	if err != nil || bytes.Equal(old.Bytes, current.Bytes) {
		t.Fatal("release data did not change", err)
	}
	got, err := newSource.RestoreTemplate(old, 19)
	if err != nil || got.Wallet != (Resources{8000, 8000, 5000, 5000}) || got.Buildings["hall"].Level != 1 || got.PlayerID != 19 {
		t.Fatal("restore substituted latest values", err)
	}
	// Unknown semantics are APP's retained-manifest obligation, not this parser's.
	if ValidateFreshTemplateContent(current) != nil {
		t.Fatal("pure parser selected semantics")
	}
}

func TestPGFreshTemplateSourceRetirement(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	initial, versions := freshTemplateSourceInput()
	content, err := f.source.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	rows := freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)
	alias := *f.source
	original := maps.Clone(f.hub.cat)
	delete(f.hub.cat, 7) // Sequential drift only; no ordinary data race is supported.
	o, a := recruitWalletBegin(t, ctx, f.binding)
	if err := alias.PinWallet(ctx, a); err == nil || !f.source.state.retired.Load() {
		t.Fatal("drift did not retire shared source")
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	f.hub.cat = original
	for _, p := range []*FreshCityParticipant{f.source, &alias} {
		if got, err := p.CaptureTemplate(initial, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
			t.Fatal("retired capture revived")
		}
		if got, err := p.RestoreTemplate(content, 7); err == nil || got != nil {
			t.Fatal("retired restore revived")
		}
	}
	if ValidateFreshTemplateContent(content) != nil || !reflect.DeepEqual(rows, freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)) {
		t.Fatal("retirement corrupted data or changed business rows")
	}
}
