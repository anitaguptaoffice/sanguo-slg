package march

import (
	"bytes"
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// recruitPendingSnapshot owns raw copied fields, not validated work or authority.
// Decoding, accepted evidence and capacity checks belong to the caller's state path.
type recruitPendingSnapshot struct {
	stock            []recruitStockRow
	ids, players     []int64
	statuses         []int16
	starts, finishes []time.Time
	payloads         []string
}

// readRecruitPending requires an already validated, pinned source and the ordered
// outer actor/wallet/WORLD barriers. It locks marker, ALL stock, then ALL pending.
// It neither certifies the 23-object Return source nor classifies terminal history.
func readRecruitPending(ctx context.Context, a *recruittx.Access, s *freshMilitarySource, scope recruitScope) (recruitPendingSnapshot, error) {
	if ctx == nil || a == nil || s == nil || s.binding == nil || s.retired.Load() {
		return recruitPendingSnapshot{}, ErrRecruitUnavailable
	}
	var owner int64
	var cohort []byte
	var format int16
	if err := recruitHistoryRead(ctx, a, s, `SELECT owner_player_id,cohort_id,format_version FROM `+pgx.Identifier{s.profile.SchemaName, "mil_city_origin"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{scope.server, scope.city}, &owner, &cohort, &format); err != nil {
		return recruitPendingSnapshot{}, err
	}
	if owner != scope.player || format != 1 || !bytes.Equal(cohort, s.profile.Cohort[:]) {
		return recruitPendingSnapshot{}, ErrRecruitUnavailable
	}
	var units, counts, wounded []int32
	if err := recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(wounded ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count,wounded FROM `+pgx.Identifier{s.profile.SchemaName, "city_troop"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`, []any{scope.server, scope.city}, &units, &counts, &wounded); err != nil {
		return recruitPendingSnapshot{}, err
	}
	if len(units) != 4 || len(counts) != 4 || len(wounded) != 4 {
		return recruitPendingSnapshot{}, ErrRecruitUnavailable
	}
	stock := make([]recruitStockRow, 4)
	for i := range units {
		stock[i] = recruitStockRow{server: scope.server, city: scope.city, unit: units[i], ready: int64(counts[i]), wounded: int64(wounded[i])}
	}
	var ids, players []int64
	var statuses []int16
	var starts, finishes []time.Time
	var payloads []string
	if err := recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(queue_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(player_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(status ORDER BY queue_id),'{}'::pg_catalog.int2[]),COALESCE(pg_catalog.array_agg(start_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(finish_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(payload::pg_catalog.text ORDER BY queue_id),'{}'::pg_catalog.text[]) FROM (SELECT queue_id,player_id,status,start_at,finish_at,payload FROM `+pgx.Identifier{s.profile.SchemaName, "work_queue"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND queue_type OPERATOR(pg_catalog.=) 3 AND status IN (0,1) ORDER BY queue_id FOR UPDATE) q`, []any{scope.server, scope.city}, &ids, &players, &statuses, &starts, &finishes, &payloads); err != nil {
		return recruitPendingSnapshot{}, err
	}
	if len(ids) != len(players) || len(ids) != len(statuses) || len(ids) != len(starts) || len(ids) != len(finishes) || len(ids) != len(payloads) {
		return recruitPendingSnapshot{}, ErrRecruitUnavailable
	}
	return recruitPendingSnapshot{stock: stock, ids: ids, players: players, statuses: statuses, starts: starts, finishes: finishes, payloads: payloads}, nil
}
