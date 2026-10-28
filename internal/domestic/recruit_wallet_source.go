package domestic

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrRecruitWalletSource denotes definite source or metadata mismatch; matching
// expectations does not establish external enrollment or writer exclusion.
var ErrRecruitWalletSource = errors.New("domestic: recruit wallet source unavailable")

type RecruitWallet struct {
	binding *recruittx.Binding
	profile freshsource.Profile
	retired *atomic.Bool
}

// NewRecruitWallet validates independent expectations in the caller-owned
// transaction. It does not enroll a source, own its lifecycle, or spend funds.
func NewRecruitWallet(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*RecruitWallet, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || b == nil || a == nil || ctx == nil || len(p.Objects) != 2 {
		return nil, ErrRecruitWalletSource
	}
	for _, n := range []string{"player_wallet", "player_wallet_pkey"} {
		if _, ok := p.Objects[n]; !ok {
			return nil, ErrRecruitWalletSource
		}
	}
	copyAccess := *a
	w := &RecruitWallet{binding: b, profile: p, retired: new(atomic.Bool)}
	if err = w.validate(ctx, &copyAccess); err != nil {
		return nil, err
	}
	return w, nil
}

// Pin takes only the qualified wallet relation lock, then revalidates. Definite
// drift retires every value copy; transaction errors do not poison the source.
func (w *RecruitWallet) Pin(ctx context.Context, a *recruittx.Access) error {
	if w == nil || w.binding == nil || w.retired == nil || w.retired.Load() || ctx == nil || a == nil {
		return ErrRecruitWalletSource
	}
	copyAccess := *a
	_, err := copyAccess.Exec(ctx, w.binding, "LOCK TABLE "+pgx.Identifier{w.profile.SchemaName, "player_wallet"}.Sanitize()+" IN ROW EXCLUSIVE MODE")
	if err != nil {
		var e *pgconn.PgError
		if errors.As(err, &e) && (e.Code == "42P01" || e.Code == "3F000" || e.Code == "42809" || e.Code == "42501") {
			w.retired.Store(true)
		}
		return err
	}
	err = w.validate(ctx, &copyAccess)
	if errors.Is(err, ErrRecruitWalletSource) {
		w.retired.Store(true)
	}
	if err == nil && w.retired.Load() {
		return ErrRecruitWalletSource
	}
	return err
}

func (w *RecruitWallet) validate(ctx context.Context, a *recruittx.Access) error {
	objects, err := json.Marshal(w.profile.Objects)
	if err != nil {
		return err
	}
	var valid bool
	p := w.profile
	err = a.Scan(ctx, w.binding, recruitWalletCatalog, []any{p.DatabaseName, p.DatabaseOID, p.SchemaName, p.SchemaOID, p.SchemaOwnerOID, p.CurrentRoleName, p.CurrentRoleOID, p.SessionRoleName, p.SessionRoleOID, objects}, &valid)
	if err != nil {
		return err
	}
	if !valid {
		return ErrRecruitWalletSource
	}
	return nil
}
