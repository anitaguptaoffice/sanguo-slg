package march

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var ErrMarchDeploymentUnavailable = errors.New("march: durable troop deployment unavailable")

// DebitMarchTroops deducts an already normalized request from the prepared
// garrison. The caller authenticates the actor, holds the ordered actor,
// wallet and WORLD city locks, and pins MIL on this Access. The ready counts
// are provisional. The caller must create the march on the same Access and
// roll back every error, including an error after this debit.
func (p *RecruitParticipant) DebitMarchTroops(ctx context.Context, a *recruittx.Access, serverID int32, playerID, cityID int64, troops []TroopStack) ([12]int32, error) {
	if a == nil || playerID <= 0 || cityID <= 0 || playerID > marchIDCeiling || cityID > marchIDCeiling {
		return [12]int32{}, ErrMarchDeploymentUnavailable
	}
	request, err := marchDeploymentCounts(troops)
	if err != nil {
		return [12]int32{}, err
	}
	access := *a
	source, err := p.pinnedRecruitReadSource(ctx, &access, serverID)
	if err != nil {
		return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
	}
	scope := recruitScope{server: serverID, player: playerID, city: cityID}
	pending, err := readRecruitPending(ctx, &access, source, scope)
	if err != nil {
		return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
	}
	rows, err := pending.decodeRows(scope, p.catalog)
	if err != nil {
		return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
	}
	if _, err := validateRecruitPending(scope, pending.stock, rows, p.catalog); err != nil {
		return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
	}
	if len(rows) > 0 {
		if err := validateRecruitPendingEvidence(ctx, &access, source, RecruitScope{ServerID: serverID, PlayerID: playerID}, cityID, pending.ids); err != nil {
			return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
		}
	}
	var ready [12]int32
	for _, row := range pending.stock {
		i := row.unit - 1
		if int64(request[i]) > row.ready {
			return [12]int32{}, ErrInsufficientTroops
		}
		ready[i] = int32(row.ready) - request[i]
	}
	query := `UPDATE ` + source.table("city_troop") + ` SET count = $4
		WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2
		AND unit_cfg_id OPERATOR(pg_catalog.=) $3 AND count OPERATOR(pg_catalog.=) $5
		AND wounded OPERATOR(pg_catalog.=) $6 RETURNING count,wounded`
	for _, row := range pending.stock {
		i := row.unit - 1
		if request[i] == 0 {
			continue
		}
		if source.retired.Load() {
			return [12]int32{}, ErrMarchDeploymentUnavailable
		}
		var remaining int32
		var wounded int64
		args := []any{serverID, cityID, row.unit, ready[i], row.ready, row.wounded}
		if err := recruitHistoryRead(ctx, &access, source, query, args, &remaining, &wounded); err != nil {
			return [12]int32{}, errors.Join(ErrMarchDeploymentUnavailable, err)
		}
		if remaining != ready[i] || wounded != row.wounded {
			return [12]int32{}, ErrMarchDeploymentUnavailable
		}
	}
	if source.retired.Load() {
		return [12]int32{}, ErrMarchDeploymentUnavailable
	}
	return ready, nil
}

func marchDeploymentCounts(troops []TroopStack) ([12]int32, error) {
	var counts [12]int32
	if len(troops) == 0 || len(troops) > len(counts) {
		return counts, ErrInvalidMarch
	}
	for _, stack := range troops {
		unit := stack.UnitCfgID
		if unit <= 0 || unit > int32(len(counts)) || stack.Count <= 0 || counts[unit-1] != 0 {
			return [12]int32{}, ErrInvalidMarch
		}
		counts[unit-1] = stack.Count
	}
	return counts, nil
}
