package domestic

import (
	"context"
	"errors"
	"maps"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type freshSourcePG struct {
	pool    *pgxpool.Pool
	binding *recruittx.Binding
	profile freshsource.Profile
	hub     *Hub
	source  *FreshCityParticipant
}

func freshSourcePGFixture(t *testing.T, ctx context.Context, quoted bool) *freshSourcePG {
	t.Helper()
	pool, binding, profile := freshCatalogPGFixture(t, ctx, quoted)
	hub := NewHub(nil)
	// Fixture startup wiring only. Do not call UseStore's unrelated queue binder.
	hub.store, hub.serverID = NewPGStore(pool), profile.ServerID
	if !hub.SupportsAtomicCityCreation(pool, profile.ServerID) {
		t.Fatal("fixture does not satisfy APP's captured-pool/shard prerequisite")
	}
	f := &freshSourcePG{pool: pool, binding: binding, profile: profile, hub: hub}
	rows := freshCatalogPGRows(t, ctx, pool, profile.SchemaName)
	owner, access := recruitWalletBegin(t, ctx, binding)
	settings := freshSourcePGSettings(t, ctx, f, access)
	source, err := NewFreshCityParticipant(ctx, binding, access, profile, hub)
	if err != nil {
		t.Fatal("real constructor", err)
	}
	if freshSourcePGSettings(t, ctx, f, access) != settings {
		t.Fatal("constructor changed settings")
	}
	if err = owner.Commit(ctx); err != nil {
		t.Fatal("constructor ended startup transaction", err)
	}
	if !reflect.DeepEqual(rows, freshCatalogPGRows(t, ctx, pool, profile.SchemaName)) {
		t.Fatal("constructor changed business rows")
	}
	f.source = source
	return f
}

func freshSourcePGPID(t *testing.T, ctx context.Context, f *freshSourcePG, a *recruittx.Access) int32 {
	t.Helper()
	var pid int32
	if err := a.Scan(ctx, f.binding, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid); err != nil {
		t.Fatal(err)
	}
	return pid
}

// Independent observer never calls product pin planning/observation helpers.

func freshSourcePGLocks(t *testing.T, ctx context.Context, f *freshSourcePG, pid int32, mode string, granted bool) int {
	t.Helper()
	mask := 0
	for i, name := range []string{"player_wallet", "city_production_checkpoint", "city_building"} {
		var held bool
		err := f.pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks
WHERE pid=$1 AND database=$2 AND relation=$3 AND locktype='relation' AND ($4='' OR mode=$4) AND granted=$5)`,
			pid, f.profile.DatabaseOID, f.profile.Objects[name].OID, mode, granted).Scan(&held)
		if err != nil {
			t.Fatal(err)
		}
		if held {
			mask |= 1 << i
		}
	}
	return mask
}

func freshSourcePGSettings(t *testing.T, ctx context.Context, f *freshSourcePG, a *recruittx.Access) string {
	t.Helper()
	var settings string
	if err := a.Scan(ctx, f.binding, `SELECT jsonb_object_agg(name,setting)::text FROM pg_catalog.pg_settings`, nil, &settings); err != nil {
		t.Fatal(err)
	}
	return settings
}

func freshSourcePGPin(t *testing.T, ctx context.Context, p *FreshCityParticipant, a *recruittx.Access) {
	t.Helper()
	if err := p.PinWallet(ctx, a); err != nil {
		t.Fatal("wallet", err)
	}
	if err := p.PinCityState(ctx, a); err != nil {
		t.Fatal("city", err)
	}
}

func TestPGFreshSourceConstructorRejects(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	o, a := recruitWalletBegin(t, ctx, f.binding)
	changes := map[string]func(*Hub, *freshsource.Profile){
		"store_nil":              func(h *Hub, _ *freshsource.Profile) { h.store = nil },
		"pool_nil":               func(h *Hub, _ *freshsource.Profile) { h.store.Pool = nil },
		"shard_zero":             func(h *Hub, _ *freshsource.Profile) { h.serverID = 0 },
		"shard_wrong":            func(h *Hub, _ *freshsource.Profile) { h.serverID++ },
		"catalog_nil":            func(h *Hub, _ *freshsource.Profile) { h.cat = nil },
		"catalog_invalid":        func(h *Hub, _ *freshsource.Profile) { h.cat[0] = BuildingSpec{} },
		"profile_incomplete":     func(_ *Hub, p *freshsource.Profile) { p.EvidenceDigest = [32]byte{} },
		"profile_wrong_database": func(_ *Hub, p *freshsource.Profile) { p.DatabaseOID++ },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			h := NewHub(nil)
			h.store, h.serverID = NewPGStore(f.pool), f.profile.ServerID
			profile, _ := freshsource.Snapshot(f.profile)
			change(h, &profile)
			if got, err := NewFreshCityParticipant(ctx, f.binding, a, profile, h); err == nil || got != nil {
				t.Fatal("invalid constructor input admitted")
			}
		})
	}
	t.Run("hub_nil", func(t *testing.T) {
		if got, err := NewFreshCityParticipant(ctx, f.binding, a, f.profile, nil); err == nil || got != nil {
			t.Fatal("nil Hub admitted")
		}
	})
	if got, err := NewFreshCityParticipant(ctx, f.binding, a, f.profile, f.hub); err != nil || got == nil {
		t.Fatal("invalid inputs changed healthy caller transaction", err)
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGFreshSourceOperationalErrors(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	owner, access := recruitWalletBegin(t, ctx, f.binding)
	other, err := recruittx.NewBinding(f.pool)
	if err != nil {
		t.Fatal(err)
	}
	foreignOwner, foreign := recruitWalletBegin(t, ctx, other)
	canceled, cancelNow := context.WithCancel(ctx)
	cancelNow()
	expired, expire := context.WithDeadline(ctx, time.Now().Add(-time.Second))
	defer expire()
	cases := []struct {
		name   string
		ctx    context.Context
		access *recruittx.Access
		want   error
	}{
		{"nil_access", ctx, nil, recruittx.ErrBinding},
		{"zero_access", ctx, &recruittx.Access{}, recruittx.ErrBinding},
		{"foreign_binding_same_pool", ctx, foreign, recruittx.ErrBinding},
		{"nil_context", nil, access, recruittx.ErrDeadline},
		{"canceled", canceled, access, context.Canceled},
		{"expired", expired, access, context.DeadlineExceeded},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, call := range []func(context.Context, *recruittx.Access) error{f.source.PinWallet, f.source.PinCityState} {
				if err := call(tc.ctx, tc.access); !errors.Is(err, tc.want) {
					t.Fatal("operational error changed", err)
				}
			}
		})
	}
	if err = owner.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err = foreignOwner.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	t.Run("ended", func(t *testing.T) {
		for _, call := range []func(context.Context, *recruittx.Access) error{f.source.PinWallet, f.source.PinCityState} {
			err := call(ctx, access)
			if !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
				t.Fatal("ended access admitted", err)
			}
		}
	})
	t.Run("sql_aborted", func(t *testing.T) {
		o, a := recruitWalletBegin(t, ctx, f.binding)
		if _, err := a.Exec(ctx, f.binding, "SELECT 1/0"); err == nil {
			t.Fatal("fixture did not abort")
		}
		var pgerr *pgconn.PgError
		for _, call := range []func(context.Context, *recruittx.Access) error{f.source.PinWallet, f.source.PinCityState} {
			if err := call(ctx, a); !errors.As(err, &pgerr) || pgerr.Code != "25P02" {
				t.Fatal("aborted transaction error changed", err)
			}
		}
		if err := o.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	})
	if f.source.state.retired.Load() {
		t.Fatal("operational errors retired healthy source")
	}
	o, a := recruitWalletBegin(t, ctx, f.binding)
	freshSourcePGPin(t, ctx, f.source, a)
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGFreshSourceDrift(t *testing.T) {
	for _, table := range []string{"player_wallet", "city_production_checkpoint", "city_building"} {
		for _, kind := range []string{"rename", "column"} {
			t.Run(table+"/"+kind, func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				f := freshSourcePGFixture(t, ctx, false)
				alias := *f.source
				name := pgx.Identifier{f.profile.SchemaName, table}.Sanitize()
				change, restore := "ALTER TABLE "+name+" ADD COLUMN surprise integer", "ALTER TABLE "+name+" DROP COLUMN surprise"
				if kind == "rename" {
					change = "ALTER TABLE " + name + " RENAME TO parked"
					restore = "ALTER TABLE " + pgx.Identifier{f.profile.SchemaName, "parked"}.Sanitize() + " RENAME TO " + pgx.Identifier{table}.Sanitize()
				}
				freshCatalogPGExec(t, ctx, f.pool, change)
				o, a := recruitWalletBegin(t, ctx, f.binding)
				if err := f.source.PinWallet(ctx, a); err == nil || !alias.state.retired.Load() {
					t.Fatal("post-construction drift admitted", err)
				}
				if err := o.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
				freshCatalogPGExec(t, ctx, f.pool, restore)
				o, a = recruitWalletBegin(t, ctx, f.binding)
				if kind == "rename" {
					if err := validateFreshSource(ctx, f.binding, a, f.profile); err != nil {
						t.Fatal("same-OID source was not actually restored", err)
					}
				}
				if err := alias.PinWallet(ctx, a); !errors.Is(err, errFreshSource) {
					t.Fatal("old source revived", err)
				}
				if err := alias.PinCityState(ctx, a); !errors.Is(err, errFreshSource) {
					t.Fatal("retired city segment admitted", err)
				}
				if err := o.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
			})
		}
	}
}

func TestPGFreshSourceWiringReentry(t *testing.T) {
	for _, stage := range []string{"wallet", "city"} {
		t.Run(stage, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, false)
			o, a := recruitWalletBegin(t, ctx, f.binding)
			freshSourcePGPin(t, ctx, f.source, a)
			call := f.source.PinWallet
			if stage == "city" {
				call = f.source.PinCityState
			}
			before := maps.Clone(f.hub.cat)
			delete(f.hub.cat, 7) // Sequential mutation only; no operation is running.
			if err := call(ctx, a); !errors.Is(err, errFreshSource) {
				t.Fatal("already-pinned path skipped captured catalog check", err)
			}
			f.hub.cat = before
			if err := f.source.PinCityState(ctx, a); !errors.Is(err, errFreshSource) {
				t.Fatal("restored catalog reopened participant", err)
			}
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestPGFreshSourceCityStageDrift(t *testing.T) {
	for _, tc := range []struct {
		table, column, before, after string
	}{
		{"city_production_checkpoint", "settled_submicro_ns", "0", "1"},
		{"city_building", "level", "1", "2"},
	} {
		t.Run(tc.table, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, false)
			alias := *f.source
			o, a := recruitWalletBegin(t, ctx, f.binding)
			if err := f.source.PinWallet(ctx, a); err != nil {
				t.Fatal(err)
			}
			pid := freshSourcePGPID(t, ctx, f, a)
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != 1 {
				t.Fatal("required W phase was not established", got)
			}
			ddl := "ALTER TABLE " + pgx.Identifier{f.profile.SchemaName, tc.table}.Sanitize() +
				" ALTER COLUMN " + pgx.Identifier{tc.column}.Sanitize() + " SET DEFAULT "
			freshCatalogPGExec(t, ctx, f.pool, ddl+tc.after)
			if err := alias.PinCityState(ctx, a); !errors.Is(err, errFreshSourceMetadata) {
				t.Fatal("city segment omitted complete post-pin validation", err)
			}
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != 7 || !f.source.state.retired.Load() {
				t.Fatal("city drift did not hold WCB and retire every alias", got)
			}
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			freshCatalogPGExec(t, ctx, f.pool, ddl+tc.before)
			o, a = recruitWalletBegin(t, ctx, f.binding)
			if err := validateFreshSource(ctx, f.binding, a, f.profile); err != nil {
				t.Fatal("same-OID original metadata was not restored", err)
			}
			for _, p := range []*FreshCityParticipant{f.source, &alias} {
				for _, call := range []func(context.Context, *recruittx.Access) error{p.PinWallet, p.PinCityState} {
					if err := call(ctx, a); !errors.Is(err, errFreshSource) {
						t.Fatal("restored source revived a participant alias", err)
					}
				}
			}
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}
