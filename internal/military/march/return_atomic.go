package march

import (
	"context"
	"errors"
	"reflect"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

type ReturnDisposition uint8

const (
	ReturnApplied ReturnDisposition = iota + 1
	ReturnCreditedTerminal
	ReturnAnnihilatedTerminal
	ReturnStillReturning
	ReturnEarly
)

type ReturnObservation struct {
	Candidate   ReturnCandidate
	Disposition ReturnDisposition
	ReturnAt    time.Time
}

// Complete requires the pinned source and ordered outer actor/wallet/WORLD locks.
// Applied is provisional; APP must rollback ANY error and alone owns commit/end.
func (p *ReturnParticipant) Complete(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin) (ReturnObservation, error) {
	if a == nil {
		return ReturnObservation{}, errors.Join(ErrReturnUnavailable, ErrReturnSource)
	}
	access := *a
	return p.returnObserve(ctx, &access, c, origin, true)
}

// Readback uses the same serialization barriers but never writes or authorizes retry.
func (p *ReturnParticipant) Readback(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin) (ReturnObservation, error) {
	if a == nil {
		return ReturnObservation{}, errors.Join(ErrReturnUnavailable, ErrReturnSource)
	}
	access := *a
	return p.returnObserve(ctx, &access, c, origin, false)
}

func (p *ReturnParticipant) returnObserve(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin, apply bool) (out ReturnObservation, err error) {
	defer func() {
		if p != nil && p.source != nil {
			err = returnSourceFailure(p.source, err) // Including retirement during the final read.
		}
		if err != nil {
			out = ReturnObservation{}
			err = errors.Join(ErrReturnUnavailable, err)
		}
	}()
	st, err := p.returnLocked(ctx, a, c, origin)
	if err != nil {
		return out, err
	}
	out.Candidate = c
	if st.phase == returnAnnihilated {
		out.Disposition = ReturnAnnihilatedTerminal
		return out, nil
	}
	out.ReturnAt = *st.returnAt
	if st.phase == returnCredited {
		out.Disposition = ReturnCreditedTerminal
		return out, nil
	}
	var sample time.Time
	if err = a.Scan(ctx, p.source.binding, `SELECT pg_catalog.clock_timestamp()`, nil, &sample); err != nil {
		return out, err
	}
	if !validMarchTime(sample) {
		return out, ErrReturnUnavailable
	}
	if sample.Before(out.ReturnAt) {
		out.Disposition = ReturnEarly
		return out, nil
	}
	if !apply {
		out.Disposition = ReturnStillReturning
		return out, nil
	}
	ready, err := returnCapacity(recruitScope{c.ServerID, c.PlayerID, c.CityID}, st.pending, st.units, st.counts, p.catalog)
	if err != nil {
		return out, err
	}
	if err = validateRecruitPendingEvidence(ctx, a, p.source, RecruitScope{ServerID: c.ServerID, PlayerID: c.PlayerID}, c.CityID, st.pending.ids); err != nil {
		return out, err
	}
	if err = p.returnApply(ctx, a, c, origin, st, ready); err != nil {
		return out, err
	}
	out.Disposition = ReturnApplied
	return out, nil
}

// returnCapacity validates complete copied pending payloads and all units before
// any write. It returns expected R+S only, never authority or a public plan.
func returnCapacity(scope recruitScope, pending recruitPendingSnapshot, units, counts []int32, catalog *RecruitCatalog) ([4]int64, error) {
	var ready [4]int64
	n := len(pending.ids)
	if n != len(pending.players) || n != len(pending.statuses) || n != len(pending.starts) || n != len(pending.finishes) || n != len(pending.payloads) || len(units) == 0 || len(units) != len(counts) {
		return ready, ErrReturnUnavailable
	}
	rows := make([]recruitPendingRow, n)
	for i, id := range pending.ids {
		payload, err := decodeRecruitPayload([]byte(pending.payloads[i]), catalog)
		if err != nil {
			return ready, errors.Join(ErrReturnUnavailable, err)
		}
		rows[i] = recruitPendingRow{scope: recruitScope{scope.server, pending.players[i], scope.city}, id: id, kind: 3, status: pending.statuses[i], payload: payload, start: pending.starts[i].UTC(), finish: pending.finishes[i].UTC()}
	}
	summary, err := validateRecruitPending(scope, pending.stock, rows, catalog)
	if err != nil {
		return ready, errors.Join(ErrReturnUnavailable, err)
	}
	for _, row := range pending.stock {
		ready[row.unit-1] = row.ready
	}
	var previous int32
	for i, unit := range units {
		if unit <= previous || summary.canAddCount(unit, counts[i]) != nil {
			return [4]int64{}, ErrReturnUnavailable
		}
		ready[unit-1] += int64(counts[i])
		previous = unit
	}
	return ready, nil
}

// returnApply consumes only the private validated snapshot in the captured Access.
// No abort statement: the fixed APP caller must rollback even a zero-row error.
func (p *ReturnParticipant) returnApply(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin, st returnLockedSnapshot, ready [4]int64) error {
	s := p.source
	run := func(query string, args ...any) error {
		if s.retired.Load() {
			return ErrReturnSource
		}
		tag, err := a.Exec(ctx, s.binding, query, args...)
		if err != nil {
			return returnSourceFailure(s, err)
		}
		if tag.RowsAffected() != 1 {
			return ErrReturnUnavailable
		}
		return nil
	}
	for _, row := range st.pending.stock {
		if ready[row.unit-1] == row.ready {
			continue
		}
		if err := run(`UPDATE `+s.table("city_troop")+` SET count = $4 WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND unit_cfg_id OPERATOR(pg_catalog.=) $3 AND count OPERATOR(pg_catalog.=) $5 AND wounded OPERATOR(pg_catalog.=) $6`, c.ServerID, c.CityID, row.unit, ready[row.unit-1], row.ready, row.wounded); err != nil {
			return err
		}
	}
	if err := run(`UPDATE `+s.table("march_order")+` SET status = 4 WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2 AND army_id OPERATOR(pg_catalog.=) $3 AND origin_city_id OPERATOR(pg_catalog.=) $4 AND status OPERATOR(pg_catalog.=) 3 AND return_finish_at OPERATOR(pg_catalog.=) $5`, c.ServerID, c.MarchID, c.ArmyID, c.CityID, *st.returnAt); err != nil {
		return err
	}
	if err := run(`UPDATE `+s.table("field_army")+` SET status = 1,x = $4,y = $5 WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 AND owner_player_id OPERATOR(pg_catalog.=) $3 AND status OPERATOR(pg_catalog.=) 2 AND x OPERATOR(pg_catalog.=) $6 AND y OPERATOR(pg_catalog.=) $7 AND hero_ids OPERATOR(pg_catalog.=) $8::pg_catalog.int8[]`, c.ServerID, c.ArmyID, c.PlayerID, origin.X, origin.Y, st.x, st.y, st.heroes); err != nil {
		return err
	}
	return p.returnVerify(ctx, a, c, origin, st, ready)
}

// Actual nonlocking reads under retained locks verify effects and unchanged graph;
// never invoke the full lock loader again after taking the later march/army locks.
func (p *ReturnParticipant) returnVerify(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin, st returnLockedSnapshot, ready [4]int64) error {
	s := p.source
	read := func(query string, args []any, dest ...any) error {
		return returnSourceFailure(s, a.Scan(ctx, s.binding, query, args, dest...))
	}
	var units, counts, wounded []int32
	if err := read(`SELECT pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),pg_catalog.array_agg(count ORDER BY unit_cfg_id),pg_catalog.array_agg(wounded ORDER BY unit_cfg_id) FROM `+s.table("city_troop")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2`, []any{c.ServerID, c.CityID}, &units, &counts, &wounded); err != nil {
		return err
	}
	if len(units) != 4 || len(counts) != 4 || len(wounded) != 4 {
		return ErrReturnUnavailable
	}
	for i, row := range st.pending.stock {
		if units[i] != row.unit || int64(counts[i]) != ready[row.unit-1] || int64(wounded[i]) != row.wounded {
			return ErrReturnUnavailable
		}
	}
	var actual returnLockedSnapshot
	if err := read(`SELECT army_id,origin_city_id,status,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,return_finish_at FROM `+s.table("march_order")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2`, []any{c.ServerID, c.MarchID}, &actual.armyID, &actual.cityID, &actual.status, &actual.fromX, &actual.fromY, &actual.toX, &actual.toY, &actual.purpose, &actual.depart, &actual.arrive, &actual.returnAt); err != nil {
		return err
	}
	if err := read(`SELECT owner_player_id,status,x,y,hero_ids FROM `+s.table("field_army")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2`, []any{c.ServerID, c.ArmyID}, &actual.owner, &actual.armyStatus, &actual.x, &actual.y, &actual.heroes); err != nil {
		return err
	}
	if err := read(`SELECT pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),pg_catalog.array_agg(count ORDER BY unit_cfg_id) FROM `+s.table("army_troop")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2`, []any{c.ServerID, c.ArmyID}, &actual.units, &actual.counts); err != nil {
		return err
	}
	actual.depart, actual.arrive = actual.depart.UTC(), actual.arrive.UTC()
	if actual.returnAt != nil {
		at := actual.returnAt.UTC()
		actual.returnAt = &at
	}
	st.pending, st.phase = recruitPendingSnapshot{}, 0
	st.status, st.armyStatus, st.x, st.y = 4, 1, origin.X, origin.Y
	if !reflect.DeepEqual(actual, st) {
		return ErrReturnUnavailable
	}
	return nil
}
