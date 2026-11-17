package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// Concrete production participants only. Each Pin also revalidates metadata.
func recruitAccessPins(t *testing.T, ctx context.Context, bundle *recruitParticipants, access *recruittx.Access, ended bool) {
	t.Helper()
	for _, call := range []struct {
		name string
		pin  func(context.Context, *recruittx.Access) error
	}{
		{"account", bundle.actor.Pin}, {"wallet", bundle.wallet.Pin},
		{"city", bundle.city.Pin}, {"military", bundle.military.Pin},
	} {
		err := call.pin(ctx, access)
		if ended {
			// Cancellation of the owner's context can win the gate race.
			if !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
				t.Fatalf("%s ended Pin: %v", call.name, err)
			}
		} else if err != nil {
			t.Fatalf("%s live Pin: %v", call.name, err)
		}
	}
}

func recruitAccessRecorded(t *testing.T, trace *returnPGTrace, from int, profile freshsource.Profile) {
	t.Helper()
	pins, reads := 0, 0
	for _, query := range trace.events()[from:] {
		returnPGOK(t, query.err)
		switch recruitPGSQLKind(query.sql, profile) {
		case 3:
			pins++
		case 4:
			reads++
		default:
			t.Fatal("unexpected participant SQL", query.sql)
		}
	}
	returnLifetimeCheck(t, pins == 9 && reads > 0, "missing real participant pins/metadata", pins, reads)
}

func recruitAccessOwner(t *testing.T, ctx context.Context, binding *recruittx.Binding) *recruittx.Owner {
	t.Helper()
	owner, err := binding.Begin(ctx)
	returnPGOK(t, err)
	t.Cleanup(func() {
		clean, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := owner.Rollback(clean); err != nil && !errors.Is(err, recruittx.ErrInactive) {
			t.Error("owned transaction cleanup", err)
		}
	})
	return owner
}

func TestPGRecruitBundleCopiedAccessLifetime(t *testing.T) {
	for _, end := range []string{"commit", "rollback"} {
		t.Run(end, func(t *testing.T) {
			trace := returnLifetimeTracer("")
			observer, binding, profile := recruitLifetimeFixture(t, trace)
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			returnPGOK(t, g.initialize(ctx))
			recruitLifetimeState(t, g, 0, false, true)
			recruitPGRecorded(t, &trace.returnPGTrace, observer, profile, 9)
			bundle := g.s.bundle
			// This is a NEW owner composing the initialized bundle, not interception
			// of initialize's private validation Access or business admission.
			owner := recruitAccessOwner(t, ctx, g.s.binding)
			original := owner.Access()
			copied := *original
			retained := copied
			*original = recruittx.Access{}
			returnPGOK(t, copied.CheckSameTransaction(ctx, g.s.binding, &retained))
			start := len(trace.events())
			recruitAccessPins(t, ctx, bundle, &copied, false)
			recruitAccessRecorded(t, &trace.returnPGTrace, start, profile)
			start = len(trace.events())
			recruitAccessPins(t, ctx, bundle, &retained, false)
			recruitAccessRecorded(t, &trace.returnPGTrace, start, profile)
			pid := trace.events()[start].pid
			returnLifetimeCheck(t, recruitPinWitness(t, ctx, observer, trace, profile, 9, 0) == pid, "pin witness used another backend")
			var database string
			returnPGOK(t, copied.Scan(ctx, g.s.binding, "SELECT current_database()", nil, &database))
			returnLifetimeCheck(t, database == profile.DatabaseName, "copied Access metadata source differs")
			start = len(trace.events())
			if end == "commit" {
				returnPGOK(t, owner.Commit(ctx))
			} else {
				returnPGOK(t, owner.Rollback(ctx))
			}
			events := trace.events()
			returnLifetimeCheck(t, len(events) == start+1 && events[start].sql == end && events[start].err == nil, "owner end was not one confirmed statement")
			start = len(events)
			for _, access := range []*recruittx.Access{&copied, &retained, owner.Access()} {
				recruitAccessPins(t, ctx, bundle, access, true)
				database = "not scanned"
				err := access.Scan(ctx, g.s.binding, "SELECT current_database()", nil, &database)
				returnLifetimeCheck(t, (errors.Is(err, recruittx.ErrInactive) || errors.Is(err, context.Canceled)) && database == "not scanned", "ended metadata Scan executed", err)
				err = access.CheckSameTransaction(ctx, g.s.binding, &retained)
				returnLifetimeCheck(t, errors.Is(err, recruittx.ErrInactive) || errors.Is(err, context.Canceled), "ended identity check reopened", err)
			}
			returnLifetimeCheck(t, len(trace.events()) == start, "ended Access submitted SQL")
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "copied Access changed rows/allocators")
			// An unrelated fresh owner is usable; ended errors must not retire any
			// concrete participant or make the old transaction active again.
			fresh := recruitAccessOwner(t, ctx, g.s.binding)
			access := *fresh.Access()
			returnLifetimeCheck(t, errors.Is(access.CheckSameTransaction(ctx, g.s.binding, &copied), recruittx.ErrBinding), "fresh owner reused old transaction identity")
			start = len(trace.events())
			recruitAccessPins(t, ctx, bundle, &access, false)
			recruitAccessRecorded(t, &trace.returnPGTrace, start, profile)
			returnPGOK(t, fresh.Rollback(ctx))
			start = len(trace.events())
			recruitAccessPins(t, ctx, bundle, &copied, true)
			returnLifetimeCheck(t, len(trace.events()) == start, "fresh owner reactivated copied Access")
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "fresh owner changed rows/allocators")
			returnPGOK(t, g.close())
			returnPGOK(t, g.s.admission.waitDrained(ctx))
		})
	}
}

func TestPGRecruitBundleRejectsAccessSubstitution(t *testing.T) {
	for _, mode := range []string{"foreign_binding", "zero_access"} {
		t.Run(mode, func(t *testing.T) {
			trace := returnLifetimeTracer("")
			observer, binding, profile := recruitLifetimeFixture(t, trace)
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			returnPGOK(t, g.initialize(ctx))
			recruitLifetimeState(t, g, 0, false, true)
			recruitPGRecorded(t, &trace.returnPGTrace, observer, profile, 9)
			bundle := g.s.bundle
			ownerBinding := g.s.binding
			if mode == "foreign_binding" {
				// The caller's original wrapper shares the real pool but is NOT the
				// exact private pointer captured by the initialized participants.
				returnLifetimeCheck(t, binding != g.s.binding, "foreign Binding was not distinct")
				ownerBinding = binding
			}
			start := len(trace.events())
			owner := recruitAccessOwner(t, ctx, ownerBinding)
			events := trace.events()
			returnLifetimeCheck(t, len(events) == start+1 && recruitPGSQLKind(events[start].sql, profile) == 1 && events[start].err == nil, "substitution owner did not actually Begin")
			pid := events[start].pid
			returnLifetimeCheck(t, pid != observer.PgConn().PID(), "owner reused independent observer")
			owned := *owner.Access()
			returnPGOK(t, owned.CheckSameTransaction(ctx, ownerBinding, owner.Access()))
			var database string
			returnPGOK(t, owned.Scan(ctx, ownerBinding, "SELECT current_database()", nil, &database))
			returnLifetimeCheck(t, database == profile.DatabaseName, "substitution owner uses another database")
			substituted := owned
			if mode == "zero_access" {
				substituted = recruittx.Access{}
			}
			start = len(trace.events())
			for _, call := range []struct {
				name string
				pin  func(context.Context, *recruittx.Access) error
			}{
				{"account", bundle.actor.Pin}, {"wallet", bundle.wallet.Pin},
				{"city", bundle.city.Pin}, {"military", bundle.military.Pin},
			} {
				returnPGOK(t, ctx.Err())
				err := call.pin(ctx, &substituted)
				returnLifetimeCheck(t, err == recruittx.ErrBinding, "substitution did not return exact ErrBinding", call.name, err)
				returnPGOK(t, ctx.Err())
				returnLifetimeCheck(t, len(trace.events()) == start, "substitution submitted participant SQL", call.name)
			}
			database = "not scanned"
			err = substituted.Scan(ctx, g.s.binding, "SELECT current_database()", nil, &database)
			returnLifetimeCheck(t, err == recruittx.ErrBinding && database == "not scanned" && len(trace.events()) == start, "substitution submitted metadata SQL", err)
			returnPGOK(t, owned.CheckSameTransaction(ctx, ownerBinding, owner.Access()))
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "substitution changed live fixture rows/allocators")
			clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
			err = owner.Rollback(clean)
			stop()
			returnPGOK(t, err)
			events = trace.events()
			returnLifetimeCheck(t, len(events) == start+1 && events[start].sql == "rollback" && events[start].pid == pid && events[start].err == nil, "substitution owner did not confirm one rollback")
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "substitution cleanup changed rows/allocators")
			// Rejection must not retire any participant or poison the captured source.
			fresh := recruitAccessOwner(t, ctx, g.s.binding)
			access := *fresh.Access()
			start = len(trace.events())
			recruitAccessPins(t, ctx, bundle, &access, false)
			recruitAccessRecorded(t, &trace.returnPGTrace, start, profile)
			returnPGOK(t, fresh.Rollback(ctx))
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "healthy recovery changed rows/allocators")
			recruitLifetimeState(t, g, 0, false, true)
			returnPGOK(t, g.close())
			returnPGOK(t, g.s.admission.waitDrained(ctx))
		})
	}
}
