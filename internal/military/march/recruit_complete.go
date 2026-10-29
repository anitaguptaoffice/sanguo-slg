package march

import (
	"bytes"
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// RecruitCompletion is a completion disposition; only RecruitCompleted mutates rows.
type RecruitCompletion uint8

const (
	RecruitCompleted   RecruitCompletion = 1
	RecruitAlreadyDone RecruitCompletion = 2
	RecruitEarly       RecruitCompletion = 3
	RecruitWaiting     RecruitCompletion = 4
)

var (
	errRecruitCompletionWrite = errors.New("march: recruit completion affected an unexpected row count")
	errRecruitCompletionAbort = errors.New("march: recruit completion abort statement unexpectedly succeeded")
)

type recruitCompletionState struct {
	source *freshMilitarySource
	plan   recruitCompletionPlan
	done   bool
}

// Complete runs only in the caller's transaction after the WORLD city FOR UPDATE
// lock, never begins/commits/rolls back, repeats the frozen lock-ordered
// validation, samples clock_timestamp once, and applies all effects atomically.
func (p *RecruitParticipant) Complete(ctx context.Context, a *recruittx.Access, c RecruitCandidate) (RecruitCompletion, error) {
	st, err := p.recruitCompletionLocked(ctx, a, c)
	if err != nil {
		return 0, err
	}
	switch st.plan.disposition {
	case recruitCompletionDue:
		if err = p.recruitCompletionApply(ctx, a, c, st); err != nil {
			return 0, err
		}
		return RecruitCompleted, nil
	case recruitCompletionWaiting:
		return RecruitWaiting, nil
	case recruitCompletionEarly:
		return RecruitEarly, nil
	}
	if st.done {
		return RecruitAlreadyDone, nil
	}
	return 0, ErrRecruitUnavailable
}

// recruitCompletionLocked repeats the frozen lock order, validates the complete
// pending type3 set and immutable evidence, then decides without writing.
func (p *RecruitParticipant) recruitCompletionLocked(ctx context.Context, a *recruittx.Access, c RecruitCandidate) (st recruitCompletionState, err error) {
	s, err := p.recruitCandidateSource(ctx, a, c)
	if err != nil {
		return st, err
	}
	st.source = s
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	var cohort []byte
	owner, format := int64(0), int16(0)
	if err = recruitHistoryRead(ctx, a, s, `SELECT owner_player_id,cohort_id,format_version FROM `+table("mil_city_origin")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{c.ServerID, c.CityID}, &owner, &cohort, &format); err != nil {
		return st, err
	}
	if owner != c.PlayerID || format != 1 || !bytes.Equal(cohort, s.profile.Cohort[:]) {
		return st, ErrRecruitUnavailable
	}
	var units, counts, wounded []int32
	if err = recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(wounded ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count,wounded FROM `+table("city_troop")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`, []any{c.ServerID, c.CityID}, &units, &counts, &wounded); err != nil {
		return st, err
	}
	if len(units) != 4 || len(counts) != 4 || len(wounded) != 4 {
		return st, ErrRecruitUnavailable
	}
	stock := make([]recruitStockRow, 4)
	for i := range units {
		stock[i] = recruitStockRow{server: c.ServerID, city: c.CityID, unit: units[i], ready: int64(counts[i]), wounded: int64(wounded[i])}
	}
	var ids, players []int64
	var starts, finishes []time.Time
	statuses, payloads := []int16{}, []string{}
	if err = recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(queue_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(player_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(status ORDER BY queue_id),'{}'::pg_catalog.int2[]),COALESCE(pg_catalog.array_agg(start_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(finish_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(payload::pg_catalog.text ORDER BY queue_id),'{}'::pg_catalog.text[]) FROM (SELECT queue_id,player_id,status,start_at,finish_at,payload FROM `+table("work_queue")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND queue_type OPERATOR(pg_catalog.=) 3 AND status IN (0,1) ORDER BY queue_id FOR UPDATE) q`, []any{c.ServerID, c.CityID}, &ids, &players, &statuses, &starts, &finishes, &payloads); err != nil {
		return st, err
	}
	rows := make([]recruitPendingRow, len(ids))
	for i := range ids {
		payload, err := decodeRecruitPayload([]byte(payloads[i]), p.catalog)
		if err != nil {
			return st, ErrRecruitUnavailable
		}
		starts[i], finishes[i] = starts[i].UTC(), finishes[i].UTC()
		rows[i] = recruitPendingRow{scope: recruitScope{server: c.ServerID, player: players[i], city: c.CityID}, id: ids[i], kind: 3, status: statuses[i], payload: payload, start: starts[i], finish: finishes[i]}
	}
	scope := recruitScope{server: c.ServerID, player: c.PlayerID, city: c.CityID}
	if _, err = validateRecruitPending(scope, stock, rows, p.catalog); err != nil {
		return st, ErrRecruitUnavailable
	}
	if len(ids) > 0 {
		if _, err = a.Exec(ctx, s.binding, `SELECT queue_id FROM `+table("mil_recruit_receipt")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_id OPERATOR(pg_catalog.=) ANY($2::pg_catalog.int8[]) ORDER BY queue_id FOR UPDATE`, c.ServerID, ids); err != nil {
			return st, errors.Join(ErrRecruitUnavailable, s.failure(err))
		}
		if err = validateRecruitPendingEvidence(ctx, a, s, RecruitScope{ServerID: c.ServerID, PlayerID: c.PlayerID}, c.CityID, ids); err != nil {
			return st, err
		}
	}
	if x, err := p.recruitCandidateRead(ctx, a, c, ""); err != nil {
		return st, err
	} else if !recruitCandidateEvidence(p, x, c) {
		return st, ErrRecruitUnavailable
	} else if st.done = x.q.status == 2; st.done {
		return st, nil
	}
	var sample time.Time
	if err = recruitHistoryRead(ctx, a, s, `SELECT pg_catalog.clock_timestamp()`, nil, &sample); err != nil {
		return st, err
	}
	plan, err := planRecruitCompletion(scope, stock, rows, p.catalog, c.QueueID, sample)
	if err != nil {
		return st, ErrRecruitUnavailable
	}
	st.plan = plan
	return st, nil
}

// recruitCompletionApply writes credit, done and one promotion atomically; a
// failure after an earlier write poisons the caller's transaction.
func (p *RecruitParticipant) recruitCompletionApply(ctx context.Context, a *recruittx.Access, c RecruitCandidate, st recruitCompletionState) error {
	plan, s := st.plan, st.source
	if s == nil || plan.disposition != recruitCompletionDue || plan.creditUnit < 1 || plan.creditUnit > 4 || plan.creditCount <= 0 || plan.readyAfter < plan.creditCount || plan.doneID != c.QueueID {
		return ErrRecruitUnavailable
	}
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	wrote := false
	run := func(query string, args ...any) error {
		tag, err := a.Exec(ctx, s.binding, query, args...)
		if err == nil && tag.RowsAffected() == 1 {
			wrote = true
			return nil
		}
		cause := errors.Join(ErrRecruitUnavailable, errRecruitCompletionWrite)
		if err != nil {
			cause = errors.Join(ErrRecruitUnavailable, s.failure(err))
		}
		if !wrote {
			return cause
		}
		if _, err = a.Exec(context.WithoutCancel(ctx), s.binding, "SELECT 1/0"); err == nil {
			err = errRecruitCompletionAbort
		}
		return errors.Join(cause, err)
	}
	if err := run(`UPDATE `+table("city_troop")+` SET count = count OPERATOR(pg_catalog.+) $3 WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND unit_cfg_id OPERATOR(pg_catalog.=) $4 AND count OPERATOR(pg_catalog.=) $5`, c.ServerID, c.CityID, plan.creditCount, plan.creditUnit, plan.readyAfter-plan.creditCount); err != nil {
		return err
	}
	if err := run(`UPDATE `+table("work_queue")+` SET status = 2 WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_id OPERATOR(pg_catalog.=) $2 AND player_id OPERATOR(pg_catalog.=) $3 AND city_id OPERATOR(pg_catalog.=) $4 AND queue_type OPERATOR(pg_catalog.=) 3 AND status OPERATOR(pg_catalog.=) 1`, c.ServerID, plan.doneID, c.PlayerID, c.CityID); err != nil {
		return err
	}
	if plan.promotionID != 0 {
		if err := run(`UPDATE `+table("work_queue")+` SET status = 1,start_at = $5,finish_at = $6 WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_id OPERATOR(pg_catalog.=) $2 AND player_id OPERATOR(pg_catalog.=) $3 AND city_id OPERATOR(pg_catalog.=) $4 AND queue_type OPERATOR(pg_catalog.=) 3 AND status OPERATOR(pg_catalog.=) 0`, c.ServerID, plan.promotionID, c.PlayerID, c.CityID, plan.promotion.start, plan.promotion.finish); err != nil {
			return err
		}
	}
	return nil
}
