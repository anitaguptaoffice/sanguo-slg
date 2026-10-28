package march

import (
	"bytes"
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

func validRecruitIntent(intent RecruitIntent) error {
	if intent.Version != 1 {
		return ErrRecruitUnsupportedVersion
	}
	if intent.CityID <= 0 || intent.UnitCfgID < 1 || intent.UnitCfgID > 4 || intent.Count <= 0 {
		return ErrRecruitUnavailable
	}
	return nil
}

// Prepare runs after the caller's same-transaction WORLD owner lock and locks marker,
// stock, pending queues, then reads evidence and samples the clock once; it writes no row.
// Readiness is MIL_FRESH_COHORT §4: exact owner/cohort/format 1 + four legal rows, not owner alone.
func (p *RecruitParticipant) Prepare(ctx context.Context, a *recruittx.Access, scope RecruitScope, intent RecruitIntent) (*RecruitAdmission, error) {
	s, err := p.recruitLookup(ctx, a, scope)
	if err != nil {
		return nil, err
	}
	var owner int64
	var cohort []byte
	var format int16
	if err = recruitHistoryRead(ctx, a, s, `SELECT owner_player_id,cohort_id,format_version FROM `+pgx.Identifier{s.profile.SchemaName, "mil_city_origin"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{scope.ServerID, intent.CityID}, &owner, &cohort, &format); err != nil {
		return nil, err
	}
	if owner != scope.PlayerID || format != 1 || !bytes.Equal(cohort, s.profile.Cohort[:]) {
		return nil, ErrRecruitUnavailable
	}
	var units, counts, wounded []int32
	if err = recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(wounded ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count,wounded FROM `+pgx.Identifier{s.profile.SchemaName, "city_troop"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`, []any{scope.ServerID, intent.CityID}, &units, &counts, &wounded); err != nil {
		return nil, err
	}
	if len(units) != 4 || len(counts) != 4 || len(wounded) != 4 {
		return nil, ErrRecruitUnavailable
	}
	stock := make([]recruitStockRow, 4)
	for i := range units {
		stock[i] = recruitStockRow{server: scope.ServerID, city: intent.CityID, unit: units[i], ready: int64(counts[i]), wounded: int64(wounded[i])}
	}
	var ids, players []int64
	var statuses []int16
	var starts, finishes []time.Time
	var payloads []string
	if err = recruitHistoryRead(ctx, a, s, `SELECT COALESCE(pg_catalog.array_agg(queue_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(player_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(status ORDER BY queue_id),'{}'::pg_catalog.int2[]),COALESCE(pg_catalog.array_agg(start_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(finish_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(payload::pg_catalog.text ORDER BY queue_id),'{}'::pg_catalog.text[]) FROM (SELECT queue_id,player_id,status,start_at,finish_at,payload FROM `+pgx.Identifier{s.profile.SchemaName, "work_queue"}.Sanitize()+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND queue_type OPERATOR(pg_catalog.=) 3 AND status IN (0,1) ORDER BY queue_id FOR UPDATE) q`, []any{scope.ServerID, intent.CityID}, &ids, &players, &statuses, &starts, &finishes, &payloads); err != nil {
		return nil, err
	}
	if len(ids) != len(players) || len(ids) != len(statuses) || len(ids) != len(starts) || len(ids) != len(finishes) || len(ids) != len(payloads) {
		return nil, ErrRecruitUnavailable
	}
	rows := make([]recruitPendingRow, len(ids))
	for i := range ids {
		payload, err := decodeRecruitPayload([]byte(payloads[i]), p.catalog)
		if err != nil {
			return nil, ErrRecruitUnavailable
		}
		starts[i], finishes[i] = starts[i].UTC(), finishes[i].UTC()
		rows[i] = recruitPendingRow{scope: recruitScope{server: scope.ServerID, player: players[i], city: intent.CityID}, id: ids[i], kind: 3, status: statuses[i], payload: payload, start: starts[i], finish: finishes[i]}
	}
	summary, err := validateRecruitPending(recruitScope{server: scope.ServerID, player: scope.PlayerID, city: intent.CityID}, stock, rows, p.catalog)
	if err != nil {
		return nil, ErrRecruitUnavailable
	}
	if len(rows) > 0 {
		if err = validateRecruitPendingEvidence(ctx, a, s, scope, intent.CityID, ids); err != nil {
			return nil, err
		}
	}
	if err = validRecruitIntent(intent); err != nil {
		return nil, err
	}
	if summary.canAddCount(intent.UnitCfgID, intent.Count) != nil {
		return nil, ErrRecruitUnavailable
	}
	rule, err := p.catalog.Current(intent.UnitCfgID)
	if err != nil {
		return nil, ErrRecruitUnavailable
	}
	plan, err := rule.Plan(RecruitRequest{CityID: intent.CityID, UnitCfgID: intent.UnitCfgID, Count: intent.Count})
	if err != nil {
		return nil, ErrRecruitUnavailable
	}
	var sample time.Time
	if err = recruitHistoryRead(ctx, a, s, `SELECT pg_catalog.clock_timestamp()`, nil, &sample); err != nil {
		return nil, err
	}
	if sample, err = canonicalRecruitTime(sample); err != nil {
		return nil, ErrRecruitUnavailable
	}
	schedule, err := planRecruitSchedule(sample, plan.DurationSeconds(), finishes)
	if err != nil {
		return nil, ErrRecruitUnavailable
	}
	var queueID int64
	if err = recruitHistoryRead(ctx, a, s, `SELECT pg_catalog.nextval($1::pg_catalog.regclass)`, []any{pgx.Identifier{s.profile.SchemaName, "work_queue_id_seq"}.Sanitize()}, &queueID); err != nil {
		return nil, err
	}
	if queueID < 1 || queueID > 9007199254740991 {
		return nil, ErrRecruitUnavailable
	}
	return &RecruitAdmission{state: &recruitAdmissionState{participant: p, access: *a, scope: scope, intent: intent, queueID: queueID, plan: plan, evidence: rule, schedule: schedule, cost: plan.Cost(), acceptedAt: sample}}, nil
}

// validateRecruitPendingEvidence checks exact scoped origin and immutable receipt against each locked pending payload without a receipt row lock.
func validateRecruitPendingEvidence(ctx context.Context, a *recruittx.Access, s *freshMilitarySource, scope RecruitScope, cityID int64, ids []int64) error {
	query := `SELECT pg_catalog.count(*),pg_catalog.count(*) FILTER (WHERE (
 o.player_id OPERATOR(pg_catalog.=) $3 AND o.operation OPERATOR(pg_catalog.=) 1 AND pg_catalog.octet_length(o.command_id) OPERATOR(pg_catalog.=) 16 AND o.command_id OPERATOR(pg_catalog.<>) pg_catalog.decode(pg_catalog.repeat('00',16),'hex')
 AND r.city_id OPERATOR(pg_catalog.=) $4 AND r.intent_version OPERATOR(pg_catalog.=) 1
 AND q.payload OPERATOR(pg_catalog.=) pg_catalog.jsonb_build_object('v',1,'unit_cfg_id',r.unit_cfg_id,'count',r.count,'cost_paid',pg_catalog.jsonb_build_object('food',r.food_paid,'wood',r.wood_paid,'iron',r.iron_paid,'stone',r.stone_paid),'duration_sec',r.duration_sec,'catalog_version',pg_catalog.convert_from(r.catalog_version,'UTF8'),'rule_digest',pg_catalog.encode(r.rule_digest,'hex'))
 AND r.initial_finish_at OPERATOR(pg_catalog.=) (r.initial_start_at OPERATOR(pg_catalog.+) pg_catalog.make_interval(secs => r.duration_sec))
 AND CASE WHEN r.initial_status OPERATOR(pg_catalog.=) 1 THEN r.initial_start_at OPERATOR(pg_catalog.=) r.accepted_at AND q.status OPERATOR(pg_catalog.=) 1 AND q.start_at OPERATOR(pg_catalog.=) r.initial_start_at AND q.finish_at OPERATOR(pg_catalog.=) r.initial_finish_at
  WHEN r.initial_status OPERATOR(pg_catalog.=) 0 THEN r.initial_start_at OPERATOR(pg_catalog.>=) r.accepted_at AND q.start_at OPERATOR(pg_catalog.>=) r.accepted_at AND q.finish_at OPERATOR(pg_catalog.=) (q.start_at OPERATOR(pg_catalog.+) pg_catalog.make_interval(secs => r.duration_sec)) AND ((q.status OPERATOR(pg_catalog.=) 0 AND q.start_at OPERATOR(pg_catalog.=) r.initial_start_at AND q.finish_at OPERATOR(pg_catalog.=) r.initial_finish_at) OR q.status OPERATOR(pg_catalog.=) 1)
  ELSE false END) IS NOT TRUE)
 FROM pg_catalog.unnest($2::pg_catalog.int8[]) x(queue_id)
 JOIN ` + pgx.Identifier{s.profile.SchemaName, "work_queue"}.Sanitize() + ` q ON q.server_id OPERATOR(pg_catalog.=) $1 AND q.queue_id OPERATOR(pg_catalog.=) x.queue_id
 LEFT JOIN ` + pgx.Identifier{s.profile.SchemaName, "mil_recruit_origin"}.Sanitize() + ` o ON o.server_id OPERATOR(pg_catalog.=) $1 AND o.queue_id OPERATOR(pg_catalog.=) x.queue_id
 LEFT JOIN ` + pgx.Identifier{s.profile.SchemaName, "mil_recruit_receipt"}.Sanitize() + ` r ON r.server_id OPERATOR(pg_catalog.=) $1 AND r.queue_id OPERATOR(pg_catalog.=) x.queue_id`
	var total, bad int64
	if err := recruitHistoryRead(ctx, a, s, query, []any{scope.ServerID, ids, scope.PlayerID, cityID}, &total, &bad); err != nil {
		return err
	}
	if total != int64(len(ids)) || bad != 0 {
		return ErrRecruitUnavailable
	}
	return nil
}
