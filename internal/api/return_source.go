package api

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

var errReturnGeneration = errors.New("return source generation unavailable")

// Copies retain one owner before any Begin. Metadata and local validation are
// not enrollment, external writer exclusion, or permission to execute returns.
type returnGeneration struct{ s *returnGenerationState }
type returnGenerationState struct {
	mu                sync.Mutex
	attempted, closed bool
	binding           *recruittx.Binding
	profile           freshsource.Profile
	catalog           march.RecruitCatalog
	admission         *freshAdmission
	bundle            *returnParticipants
	phase             string
	cause             error
	attempts          map[*returnAttempt]struct{}
}
type returnParticipants struct {
	actor    *account.RecruitActorGuard
	wallet   *domestic.RecruitWallet
	city     *world.RecruitCityLocker
	military *march.ReturnParticipant
}

// Fixed inventories from MIL_RECRUIT_PORTS §1 and MIL_RETURN_CREDIT §2.
func returnSourceInventories() [4][]string {
	return [4][]string{
		{"account", "account_pkey", "uq_account_login_name", "account_account_id_seq", "account_session", "account_session_pkey",
			"idx_account_session_account", "player", "player_pkey", "uq_player_account_per_server", "idx_player_account"},
		{"player_wallet", "player_wallet_pkey"},
		{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"},
		{"mil_city_origin", "mil_city_origin_pkey", "city_troop", "city_troop_pkey", "work_queue", "work_queue_pkey", "idx_work_queue_due", "idx_work_queue_player",
			"mil_recruit_origin", "mil_recruit_receipt", "mil_recruit_origin_pkey", "mil_recruit_origin_server_id_player_id_operation_command_id_key",
			"mil_recruit_receipt_pkey", "work_queue_id_seq", "march_order", "march_order_pkey", "idx_march_arrive", "idx_march_return",
			"field_army", "field_army_pkey", "idx_field_army_owner", "army_troop", "army_troop_pkey"},
	}
}

func newReturnGeneration(binding *recruittx.Binding, expected freshsource.Profile, catalog *march.RecruitCatalog) (*returnGeneration, error) {
	if binding == nil || *binding == (recruittx.Binding{}) || catalog == nil {
		return nil, errReturnGeneration
	}
	capturedBinding, capturedCatalog := *binding, *catalog
	p, err := freshsource.Snapshot(expected)
	if err != nil || len(p.Objects) != 43 {
		return nil, errors.Join(errReturnGeneration, err)
	}
	seen := make(map[uint32]bool, 43)
	for _, names := range returnSourceInventories() {
		for _, name := range names {
			object, ok := p.Objects[name]
			if !ok || seen[object.OID] {
				return nil, errReturnGeneration
			}
			seen[object.OID] = true
		}
	}
	for unit := int32(1); unit <= 4; unit++ {
		if _, err := capturedCatalog.Current(unit); err != nil {
			return nil, errors.Join(errReturnGeneration, err)
		}
	}
	admission, err := newFreshAdmission(&capturedBinding)
	if err != nil {
		return nil, err
	}
	return &returnGeneration{s: &returnGenerationState{binding: &capturedBinding, profile: p,
		catalog: capturedCatalog, admission: admission}}, nil
}

func returnSourceProjection(p freshsource.Profile, names []string) freshsource.Profile {
	objects := make(map[string]freshsource.ObjectIdentity, len(names))
	for _, name := range names {
		objects[name] = p.Objects[name]
	}
	p.Objects = objects
	return p
}

func (g *returnGeneration) close() error {
	if g == nil || g.s == nil {
		return errReturnGeneration
	}
	g.s.mu.Lock()
	defer g.s.mu.Unlock()
	g.s.closed, g.s.bundle = true, nil
	return g.s.admission.close()
}

// initialize is one-shot even for invalid contexts. Nothing executable escapes
// until all concrete constructors/pins and the no-write rollback have succeeded.
func (g *returnGeneration) initialize(ctx context.Context) (err error) {
	if g == nil || g.s == nil {
		return errReturnGeneration
	}
	s := g.s
	s.mu.Lock()
	if s.attempted || s.closed {
		s.mu.Unlock()
		return errReturnGeneration
	}
	s.attempted = true
	s.mu.Unlock()
	var lease freshLease
	var owner *recruittx.Owner
	var bundle returnParticipants
	began, phase := false, "context"
	defer func() {
		fault := recover()
		if fault != nil {
			err = fmt.Errorf("%w: panic at %s: %v", errReturnGeneration, phase, fault)
		}
		if err != nil {
			_ = g.close()
		}
		var cleanup error
		var cleanupFault any
		if owner != nil {
			cleanup, cleanupFault = rollbackReturnValidation(owner)
		}
		if fault == nil {
			fault = cleanupFault
		}
		if lease.s != nil {
			if !began || owner != nil && cleanup == nil {
				_ = lease.ended()
			} else {
				_ = lease.unknown() // Invoked Begin without Owner is NOT known ended.
			}
		}
		err = errors.Join(err, cleanup)
		s.mu.Lock()
		if err != nil || s.closed {
			s.closed, s.bundle = true, nil
			_ = s.admission.close()
			if err == nil {
				err = errReturnGeneration
			}
		} else {
			s.bundle = &bundle
		}
		s.phase, s.cause = phase, err
		s.mu.Unlock()
		if fault != nil {
			panic(fault)
		}
	}()
	if ctx == nil {
		return recruittx.ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return recruittx.ErrDeadline
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	phase = "lease"
	if lease, err = s.admission.acquire(ctx); err != nil {
		return err
	}
	phase, began = "begin", true
	if owner, err = s.binding.Begin(ctx); err != nil {
		return err
	}
	access := *owner.Access()
	names := returnSourceInventories()
	phase = "account constructor"
	if bundle.actor, err = account.NewRecruitActorGuard(ctx, s.binding, &access, returnSourceProjection(s.profile, names[0])); err != nil {
		return err
	}
	phase = "wallet constructor"
	if bundle.wallet, err = domestic.NewRecruitWallet(ctx, s.binding, &access, returnSourceProjection(s.profile, names[1])); err != nil {
		return err
	}
	phase = "world constructor"
	if bundle.city, err = world.NewRecruitCityLocker(ctx, s.binding, &access, returnSourceProjection(s.profile, names[2])); err != nil {
		return err
	}
	phase = "military constructor"
	if bundle.military, err = march.NewReturnParticipant(ctx, s.binding, &access, returnSourceProjection(s.profile, names[3]), &s.catalog); err != nil {
		return err
	}
	phase = "account pin"
	if err = bundle.actor.Pin(ctx, &access); err != nil {
		return err
	}
	phase = "wallet pin"
	if err = bundle.wallet.Pin(ctx, &access); err != nil {
		return err
	}
	phase = "world pin"
	if err = bundle.city.Pin(ctx, &access); err != nil {
		return err
	}
	phase = "military pin"
	if err = bundle.military.Pin(ctx, &access); err != nil {
		return err
	}
	phase = "rollback"
	return nil
}

func rollbackReturnValidation(owner *recruittx.Owner) (err error, fault any) {
	defer func() {
		if fault = recover(); fault != nil {
			err = fmt.Errorf("return validation cleanup panic: %v", fault)
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return owner.Rollback(ctx), nil // Only nil confirms end; ErrTxClosed stays unknown.
}
