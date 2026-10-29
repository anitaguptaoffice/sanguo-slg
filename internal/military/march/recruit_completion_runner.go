package march

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// MaxDueRecruits bounds one discovery batch; a scanner still pages until no due rows remain.
const MaxDueRecruits = 256

// RecruitDueScope binds a discovery pass to the participant's server.
type RecruitDueScope struct{ ServerID int32 }

// RecruitDueCursor is the last examined (finish_at, queue_id); the zero value starts at the beginning.
type RecruitDueCursor struct {
	FinishAt time.Time
	QueueID  int64
}

// RecruitDueJob is a copied discovery identity plus its stored due time, never authorization.
type RecruitDueJob struct {
	RecruitCandidate
	FinishAt time.Time
}

// RecruitDueEffect reports one completed job's visible effects for later memory publication; it is not a commit receipt.
type RecruitDueEffect struct {
	CityID, DoneID, PromotedID int64
	UnitCfgID, Count           int32
	PromotedFinishAt           time.Time
}

// DueRecruits selects active type3 rows after the cursor with finish_at <= now,
// ordered by (finish_at, queue_id). It takes no row locks and writes nothing;
// results are candidates the caller must revalidate through ApplyDueRecruits.
func (p *RecruitParticipant) DueRecruits(ctx context.Context, a *recruittx.Access, scope RecruitDueScope, now time.Time, after RecruitDueCursor, limit int) ([]RecruitDueJob, error) {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() ||
		scope.ServerID <= 0 || scope.ServerID != p.source.profile.ServerID || limit < 1 || limit > MaxDueRecruits ||
		after.QueueID < 0 || after.QueueID > 9007199254740991 || (after.QueueID == 0) != after.FinishAt.IsZero() ||
		after.QueueID != 0 && !validRecruitTime(after.FinishAt) {
		return nil, ErrRecruitUnavailable
	}
	at, err := canonicalRecruitTime(now)
	if err != nil {
		return nil, ErrRecruitUnavailable
	}
	s, order := p.source, ` ORDER BY finish_at,queue_id`
	query := `SELECT COALESCE(pg_catalog.array_agg(queue_id` + order + `),'{}'::pg_catalog.int8[]),` +
		`COALESCE(pg_catalog.array_agg(player_id` + order + `),'{}'::pg_catalog.int8[]),` +
		`COALESCE(pg_catalog.array_agg(COALESCE(city_id,0)` + order + `),'{}'::pg_catalog.int8[]),` +
		`COALESCE(pg_catalog.array_agg(finish_at` + order + `),'{}'::pg_catalog.timestamptz[]) FROM (` +
		`SELECT queue_id,player_id,city_id,finish_at FROM ` + s.table("work_queue") +
		` WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_type OPERATOR(pg_catalog.=) 3` +
		` AND status OPERATOR(pg_catalog.=) 1 AND finish_at OPERATOR(pg_catalog.<=) $2` +
		` AND (finish_at OPERATOR(pg_catalog.>) $3 OR (finish_at OPERATOR(pg_catalog.=) $3 AND queue_id OPERATOR(pg_catalog.>) $4))` +
		order + ` LIMIT $5) q`
	var ids, players, cities []int64
	var finishes []time.Time
	if err = a.Scan(ctx, s.binding, query, []any{scope.ServerID, at, after.FinishAt.UTC(), after.QueueID, limit}, &ids, &players, &cities, &finishes); err != nil {
		return nil, errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	out := make([]RecruitDueJob, len(ids))
	for i := range ids {
		out[i] = RecruitDueJob{RecruitCandidate: RecruitCandidate{ServerID: scope.ServerID, PlayerID: players[i], CityID: cities[i], QueueID: ids[i]}, FinishAt: finishes[i].UTC()}
	}
	return out, nil
}

// ApplyDueRecruits runs Complete once per candidate in the caller-owned
// transaction. The API rejects mixed city/player batches, locks the WORLD
// player_city row FOR UPDATE, requires its current owner to equal the candidate
// player, and only then touches MIL relations. Completed rows append effects;
// waiting/early/done are no-ops. Any error is returned at once: the caller must
// roll back instead of committing a partial batch. Callers still own the earlier
// ACCOUNT -> DOM wallet pins and ordering.
func (p *RecruitParticipant) ApplyDueRecruits(ctx context.Context, a *recruittx.Access, due []RecruitDueJob) ([]RecruitDueEffect, error) {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() || len(due) > MaxDueRecruits {
		return nil, ErrRecruitUnavailable
	}
	var city, player int64
	for _, job := range due {
		c := job.RecruitCandidate
		if c.ServerID != p.source.profile.ServerID || c.PlayerID <= 0 || c.CityID <= 0 ||
			c.QueueID < 1 || c.QueueID > 9007199254740991 || !validRecruitTime(job.FinishAt) {
			return nil, ErrRecruitUnavailable
		}
		if city == 0 {
			city, player = c.CityID, c.PlayerID
		} else if c.CityID != city || c.PlayerID != player {
			return nil, ErrRecruitUnavailable
		}
	}
	if city != 0 {
		var owner int64
		if err := recruitHistoryRead(ctx, a, p.source, `SELECT player_id FROM `+p.source.table("player_city")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{p.source.profile.ServerID, city}, &owner); err != nil {
			return nil, err
		}
		// The MIL marker proves only that this city's job was accepted at some
		// point. Current WORLD ownership must still match before any credit.
		if owner != player {
			return nil, ErrRecruitUnavailable
		}
	}
	out := make([]RecruitDueEffect, 0, len(due))
	for _, job := range due {
		c := job.RecruitCandidate
		disposition, err := p.Complete(ctx, a, c)
		if err != nil {
			return nil, err
		}
		if disposition != RecruitCompleted {
			continue
		}
		effect, err := p.recruitDueEffect(ctx, a, c)
		if err != nil {
			return nil, err
		}
		out = append(out, effect)
	}
	return out, nil
}

func (p *RecruitParticipant) recruitDueEffect(ctx context.Context, a *recruittx.Access, c RecruitCandidate) (RecruitDueEffect, error) {
	s, table := p.source, p.source.table
	effect := RecruitDueEffect{CityID: c.CityID, DoneID: c.QueueID}
	var promoted *int64
	var promotedFinish *time.Time
	query := `SELECT r.unit_cfg_id,r.count,q.queue_id,q.finish_at FROM ` + table("mil_recruit_receipt") + ` r` +
		` LEFT JOIN LATERAL (SELECT queue_id,finish_at FROM ` + table("work_queue") + ` WHERE server_id OPERATOR(pg_catalog.=) $1` +
		` AND city_id OPERATOR(pg_catalog.=) $3 AND queue_type OPERATOR(pg_catalog.=) 3 AND status OPERATOR(pg_catalog.=) 1` +
		` ORDER BY queue_id LIMIT 1) q ON true WHERE r.server_id OPERATOR(pg_catalog.=) $1 AND r.queue_id OPERATOR(pg_catalog.=) $2`
	if err := a.Scan(ctx, s.binding, query, []any{c.ServerID, c.QueueID, c.CityID}, &effect.UnitCfgID, &effect.Count, &promoted, &promotedFinish); err != nil {
		return effect, errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	if promoted != nil {
		effect.PromotedID, effect.PromotedFinishAt = *promoted, promotedFinish.UTC()
	}
	if effect.UnitCfgID < 1 || effect.UnitCfgID > 4 || effect.Count <= 0 || (promoted == nil) != (promotedFinish == nil) ||
		effect.PromotedID < 0 || effect.PromotedID > 9007199254740991 ||
		promoted != nil && (effect.PromotedID < 1 || !validRecruitTime(effect.PromotedFinishAt)) {
		return effect, ErrRecruitUnavailable
	}
	return effect, nil
}
