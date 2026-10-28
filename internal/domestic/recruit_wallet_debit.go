package domestic

import (
	"context"
	"errors"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"sync"
)

var (
	ErrRecruitWalletUnavailable = errors.New("domestic: recruit wallet unavailable")
	ErrRecruitWalletCost        = errors.New("domestic: invalid recruit cost")
	ErrRecruitWalletFunds       = errors.New("domestic: insufficient recruit funds")
)

// LockedRecruitWallet is an opaque, copy-safe, transaction-scoped one-shot handle.
type LockedRecruitWallet struct{ state *lockedRecruitWalletState }
type lockedRecruitWalletState struct {
	mu      sync.Mutex
	used    bool
	wallet  RecruitWallet
	access  recruittx.Access
	player  int64
	balance Resources
	gold    int64
}

func (w *RecruitWallet) Lock(ctx context.Context, a *recruittx.Access, playerID int64) (*LockedRecruitWallet, error) {
	if w == nil || w.binding == nil || w.retired == nil || w.retired.Load() || ctx == nil || a == nil || playerID <= 0 || w.profile.ServerID <= 0 {
		return nil, ErrRecruitWalletUnavailable
	}
	privateWallet := *w
	w = &privateWallet
	snapshot := *a
	// Require the already-held exact pin, never silently acquire out of order.
	var pinned bool
	err := snapshot.Scan(ctx, w.binding, `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND granted AND relation=$1::pg_catalog.oid AND mode='RowExclusiveLock')`, []any{w.profile.Objects["player_wallet"].OID}, &pinned)
	if err != nil {
		return nil, err
	}
	if !pinned {
		return nil, ErrRecruitWalletUnavailable
	}
	if err = w.validate(ctx, &snapshot); err != nil {
		if errors.Is(err, ErrRecruitWalletSource) {
			w.retired.Store(true)
		}
		return nil, err
	}
	if w.retired.Load() {
		return nil, ErrRecruitWalletUnavailable
	}
	s := &lockedRecruitWalletState{wallet: *w, access: snapshot, player: playerID}
	q := "SELECT food,wood,iron,stone,gold FROM " + pgx.Identifier{w.profile.SchemaName, "player_wallet"}.Sanitize() + " WHERE server_id=$1 AND player_id=$2 FOR UPDATE"
	err = snapshot.Scan(ctx, w.binding, q, []any{w.profile.ServerID, playerID}, &s.balance.Food, &s.balance.Wood, &s.balance.Iron, &s.balance.Stone, &s.gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecruitWalletUnavailable
	}
	if err != nil {
		return nil, err
	}
	if !validRecruitResources(s.balance) || s.gold < 0 {
		return nil, ErrRecruitWalletUnavailable
	}
	return &LockedRecruitWallet{state: s}, nil
}
func validRecruitResources(r Resources) bool {
	return r.Food >= 0 && r.Wood >= 0 && r.Iron >= 0 && r.Stone >= 0
}

// Debit uses only the caller's transaction. APP must roll it back on any error,
// including any later participant error; updated_at is metadata, not acceptance.
func (l *LockedRecruitWallet) Debit(ctx context.Context, a *recruittx.Access, cost Resources) error {
	if l == nil || l.state == nil || ctx == nil || a == nil {
		return ErrRecruitWalletUnavailable
	}
	s := l.state
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.used {
		return ErrRecruitWalletUnavailable
	}
	w := &s.wallet
	if w.binding == nil || w.retired == nil || w.retired.Load() {
		return ErrRecruitWalletUnavailable
	}
	copyAccess := *a
	if err := s.access.CheckSameTransaction(ctx, w.binding, &copyAccess); err != nil {
		return err
	}
	s.used = true
	if err := w.validate(ctx, &copyAccess); err != nil {
		if errors.Is(err, ErrRecruitWalletSource) {
			w.retired.Store(true)
		}
		return err
	}
	if w.retired.Load() {
		return ErrRecruitWalletUnavailable
	}
	if !validRecruitResources(cost) {
		return ErrRecruitWalletCost
	}
	b := s.balance
	if cost.Food > b.Food || cost.Wood > b.Wood || cost.Iron > b.Iron || cost.Stone > b.Stone {
		return ErrRecruitWalletFunds
	}
	want := Resources{Food: b.Food - cost.Food, Wood: b.Wood - cost.Wood, Iron: b.Iron - cost.Iron, Stone: b.Stone - cost.Stone}
	table := pgx.Identifier{w.profile.SchemaName, "player_wallet"}.Sanitize()
	// Guard the locked image, including gold; RETURNING must yield exactly one row.
	q := "UPDATE " + table + " SET food=$3,wood=$4,iron=$5,stone=$6 WHERE server_id=$1 AND player_id=$2 AND food=$7 AND wood=$8 AND iron=$9 AND stone=$10 AND gold=$11 RETURNING food,wood,iron,stone,gold"
	args := []any{w.profile.ServerID, s.player, want.Food, want.Wood, want.Iron, want.Stone, b.Food, b.Wood, b.Iron, b.Stone, s.gold}
	var got Resources
	var gold int64
	err := copyAccess.Scan(ctx, w.binding, q, args, &got.Food, &got.Wood, &got.Iron, &got.Stone, &gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrRecruitWalletUnavailable
	}
	if err != nil {
		return err
	}
	if got != want || gold != s.gold {
		return ErrRecruitWalletUnavailable
	}
	q = "SELECT food,wood,iron,stone,gold FROM " + table + " WHERE server_id=$1 AND player_id=$2"
	err = copyAccess.Scan(ctx, w.binding, q, []any{w.profile.ServerID, s.player}, &got.Food, &got.Wood, &got.Iron, &got.Stone, &gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrRecruitWalletUnavailable
	}
	if err != nil {
		return err
	}
	if got != want || gold != s.gold {
		return ErrRecruitWalletUnavailable
	}
	return nil
}
