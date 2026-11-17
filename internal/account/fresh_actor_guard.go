package account

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// ActorGuard is the dormant ACCOUNT participant from FRESH_CITY_PARTICIPANTS.
// Its private concrete guard shares the reviewed source checks and lock order
// with Recruit. It does not enroll a source, authenticate a session or own a tx.
// Value copies share the same immutable binding and irreversible retirement.
type ActorGuard struct{ guard *RecruitActorGuard }

// NewActorGuard validates and copies the complete ACCOUNT source expectations.
// APP must independently establish enrollment and own validation transaction end.
func NewActorGuard(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*ActorGuard, error) {
	g, err := NewRecruitActorGuard(ctx, b, a, p)
	if err != nil {
		return nil, err
	}
	return &ActorGuard{guard: g}, nil
}

// Pin holds account then player ROW SHARE pins and revalidates the source.
func (g *ActorGuard) Pin(ctx context.Context, a *recruittx.Access) error {
	if g == nil || a == nil {
		return ErrRecruitActorGuard
	}
	access := *a
	return g.guard.Pin(ctx, &access)
}

// LockActor requires prior pins in this Access, then holds the active account
// and exact captured-shard player FOR SHARE through APP's transaction end.
// The trusted IDs come from APP authentication, never from request identity.
func (g *ActorGuard) LockActor(ctx context.Context, a *recruittx.Access, accountID, playerID int64) error {
	if g == nil || a == nil {
		return ErrRecruitActorGuard
	}
	access := *a
	return g.guard.Lock(ctx, &access, accountID, playerID)
}
