package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// CreateHero inserts only; the shared database sequence owns identity allocation.
// No schema setup or MAX-based fallback is performed when the sequence is unavailable.
func (p *PGStore) CreateHero(ctx context.Context, h *Hero) error {
	return insertHero(ctx, p.Pool, h)
}

// CreateHeroInTx participates only in the caller's transaction; it never commits,
// rolls back, opens another connection, or runs DDL. The assigned ID is provisional
// until the caller commits. Use a disposable plan copy and publish only after Commit;
// after rollback/retry, do not reuse the already-ID-assigned input.
func (p *PGStore) CreateHeroInTx(ctx context.Context, tx pgx.Tx, h *Hero) error {
	if tx == nil {
		return errors.New("hero: creation transaction required")
	}
	return insertHero(ctx, tx, h)
}

type heroInserter interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func insertHero(ctx context.Context, q heroInserter, h *Hero) error {
	if err := validateHeroCreation(h); err != nil {
		return err
	}
	created := h.CreatedAt
	if created.IsZero() {
		created = time.Now()
	}
	var id int64
	// All six production creators initialize allocated points to zero. These legacy
	// columns currently lack a formal migration; do not run their runtime DDL here.
	err := q.QueryRow(ctx, `
		INSERT INTO player_hero (
			server_id, hero_id, player_id, template_cfg_id, display_name, level, exp, loyalty,
			force, intel, politics, command, status, created_at
		) VALUES ($1,nextval('player_hero_id_seq'),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING hero_id, created_at`,
		h.ServerID, h.PlayerID, h.TemplateCfgID, nullString(h.DisplayName), h.Level, h.Exp, h.Loyalty,
		h.Force, h.Intel, h.Politics, h.Command, h.Status, created).Scan(&id, &created)
	if err != nil {
		return err
	}
	h.HeroID, h.CreatedAt = id, created
	return nil
}
