package march

import (
	"bytes"
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// ReadReadyGarrison returns copied ready counts for units 1 to 12 from one
// statement snapshot. The caller must already have checked WORLD ownership
// and installed the existing MIL pins in this transaction.
func (p *RecruitParticipant) ReadReadyGarrison(ctx context.Context, a *recruittx.Access, serverID int32, playerID, cityID int64) ([12]int32, error) {
	var out [12]int32
	if playerID <= 0 || cityID <= 0 || a == nil {
		return out, ErrRecruitUnavailable
	}
	access := *a
	s, err := p.pinnedRecruitReadSource(ctx, &access, serverID)
	if err != nil {
		return out, err
	}
	var owner int64
	var cohort []byte
	var format int16
	var units, ready, wounded []int32
	query := `SELECT m.owner_player_id,m.cohort_id,m.format_version,stock.units,stock.ready,stock.wounded
FROM ` + s.table("mil_city_origin") + ` m CROSS JOIN LATERAL (
 SELECT pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id) AS units,
        pg_catalog.array_agg(count ORDER BY unit_cfg_id) AS ready,
        pg_catalog.array_agg(wounded ORDER BY unit_cfg_id) AS wounded
 FROM (SELECT unit_cfg_id,count,wounded FROM ` + s.table("city_troop") + `
       WHERE server_id OPERATOR(pg_catalog.=) m.server_id AND city_id OPERATOR(pg_catalog.=) m.city_id
       ORDER BY unit_cfg_id LIMIT 12) stock_rows
) stock WHERE m.server_id OPERATOR(pg_catalog.=) $1 AND m.city_id OPERATOR(pg_catalog.=) $2`
	if err = recruitHistoryRead(ctx, &access, s, query, []any{serverID, cityID},
		&owner, &cohort, &format, &units, &ready, &wounded); err != nil {
		return out, err
	}
	if s.retired.Load() || owner != playerID || format != 1 || !bytes.Equal(cohort, s.profile.Cohort[:]) ||
		len(units) != len(out) || len(ready) != len(out) || len(wounded) != len(out) {
		return out, ErrRecruitUnavailable
	}
	for i, unit := range units {
		if unit != int32(i+1) || ready[i] < 0 || wounded[i] < 0 {
			return out, ErrRecruitUnavailable
		}
	}
	copy(out[:], ready)
	return out, nil
}
