package march

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// Write inserts the prepared type3 job, reverse origin and immutable receipt in
// the caller's live transaction. The first call consumes the admission; every
// error requires the caller to roll back, and no later retry is possible.
func (h *RecruitAdmission) Write(ctx context.Context, a *recruittx.Access) (RecruitAcceptance, error) {
	if h == nil || h.state == nil || !h.state.used.CompareAndSwap(false, true) {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	st, p := h.state, h.state.participant
	request := RecruitRequest{CityID: st.intent.CityID, UnitCfgID: st.intent.UnitCfgID, Count: st.intent.Count}
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil ||
		st.intent.Version != 1 || !st.evidence.valid || st.queueID < 1 || st.queueID > 9007199254740991 ||
		st.scope.ServerID != p.source.profile.ServerID || st.scope.PlayerID <= 0 ||
		st.scope.CommandID == (RecruitCommandID{}) || st.plan.Request() != request || st.plan.DurationSeconds() <= 0 ||
		!validRecruitTime(st.acceptedAt) || !validRecruitTime(st.schedule.start) || !validRecruitTime(st.schedule.finish) {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	cost := st.plan.Cost()
	finish, err := recruitFinish(st.schedule.start, st.plan.DurationSeconds())
	if cost != st.cost || err != nil || !finish.Equal(st.schedule.finish) ||
		(st.schedule.waiting && st.schedule.start.Before(st.acceptedAt)) ||
		(!st.schedule.waiting && !st.schedule.start.Equal(st.acceptedAt)) {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	s := p.source
	copyAccess := *a
	if err := a.CheckSameTransaction(ctx, s.binding, &st.access); err != nil {
		return RecruitAcceptance{}, errors.Join(ErrRecruitUnavailable, err)
	}
	if s.retired.Load() {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	raw, err := encodeRecruitPayload(st.evidence, request)
	if err != nil {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	status, digest := int16(1), st.evidence.Digest()
	if st.schedule.waiting {
		status = 0
	}
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	exec := func(query string, args ...any) error {
		tag, err := copyAccess.Exec(ctx, s.binding, query, args...)
		if err != nil {
			return errors.Join(ErrRecruitUnavailable, s.failure(err))
		}
		if tag.RowsAffected() != 1 {
			return ErrRecruitUnavailable
		}
		return nil
	}
	if err = exec(`INSERT INTO `+table("work_queue")+`(server_id,queue_id,player_id,city_id,queue_type,payload,start_at,finish_at,status) VALUES($1,$2,$3,$4,3,$5,$6,$7,$8)`,
		st.scope.ServerID, st.queueID, st.scope.PlayerID, st.intent.CityID, string(raw), st.schedule.start, st.schedule.finish, status); err != nil {
		return RecruitAcceptance{}, err
	}
	if err = exec(`INSERT INTO `+table("mil_recruit_origin")+`(server_id,queue_id,player_id,operation,command_id) VALUES($1,$2,$3,1,$4)`,
		st.scope.ServerID, st.queueID, st.scope.PlayerID, st.scope.CommandID[:]); err != nil {
		return RecruitAcceptance{}, err
	}
	if err = exec(`INSERT INTO `+table("mil_recruit_receipt")+`(server_id,queue_id,intent_version,city_id,unit_cfg_id,count,food_paid,wood_paid,iron_paid,stone_paid,duration_sec,catalog_version,rule_digest,accepted_at,initial_start_at,initial_finish_at,initial_status) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		st.scope.ServerID, st.queueID, st.intent.CityID, st.intent.UnitCfgID, st.intent.Count,
		cost.Food, cost.Wood, cost.Iron, cost.Stone, st.plan.DurationSeconds(), []byte(st.evidence.Version()), digest[:],
		st.acceptedAt, st.schedule.start, st.schedule.finish, status); err != nil {
		return RecruitAcceptance{}, err
	}
	// Revalidate the pinned source after the writes as well: any privilege,
	// dependency or trigger drift leaves these rows uncommittable.
	if err = s.failure(validateRecruitSource(ctx, &copyAccess, s)); err != nil {
		return RecruitAcceptance{}, errors.Join(ErrRecruitUnavailable, err)
	}
	q, r := recruitHistoryQueue{}, recruitHistoryReceipt{}
	var playerID int64
	var operation int16
	var command []byte
	query := `SELECT q.player_id,q.city_id,q.queue_type,q.payload,q.start_at,q.finish_at,q.status,o.player_id,o.operation,o.command_id,` +
		`r.server_id,r.queue_id,r.intent_version,r.city_id,r.unit_cfg_id,r.count,r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid,` +
		`r.duration_sec,r.catalog_version,r.rule_digest,r.accepted_at,r.initial_start_at,r.initial_finish_at,r.initial_status FROM ` +
		table("work_queue") + ` q JOIN ` + table("mil_recruit_origin") + ` o ON o.server_id=q.server_id AND o.queue_id=q.queue_id JOIN ` +
		table("mil_recruit_receipt") + ` r ON r.server_id=q.server_id AND r.queue_id=q.queue_id WHERE q.server_id=$1 AND q.queue_id=$2`
	if err = recruitHistoryRead(ctx, &copyAccess, s, query, []any{st.scope.ServerID, st.queueID},
		&q.playerID, &q.cityID, &q.queueType, &q.payload, &q.startAt, &q.finishAt, &q.status, &playerID, &operation, &command,
		&r.serverID, &r.queueID, &r.intentVersion, &r.cityID, &r.unitCfgID, &r.count, &r.food, &r.wood, &r.iron, &r.stone,
		&r.durationSec, &r.catalogVersion, &r.ruleDigest, &r.acceptedAt, &r.startAt, &r.finishAt, &r.initialStatus); err != nil {
		return RecruitAcceptance{}, err
	}
	payload, err := decodeRecruitPayload(q.payload, p.catalog)
	if err != nil || payload.Unit != st.intent.UnitCfgID || payload.Count != st.intent.Count ||
		payload.Cost != (recruitPayloadCost{Food: cost.Food, Wood: cost.Wood, Iron: cost.Iron, Stone: cost.Stone}) ||
		payload.Seconds != st.plan.DurationSeconds() || payload.Catalog != st.evidence.Version() ||
		payload.Digest != hex.EncodeToString(digest[:]) || q.playerID != st.scope.PlayerID || q.cityID == nil ||
		*q.cityID != st.intent.CityID || q.queueType != 3 || q.status != status || !q.startAt.Equal(st.schedule.start) ||
		!q.finishAt.Equal(st.schedule.finish) || playerID != st.scope.PlayerID || operation != 1 ||
		!bytes.Equal(command, st.scope.CommandID[:]) || r.serverID != int64(st.scope.ServerID) || r.queueID != st.queueID ||
		r.intentVersion != 1 || r.cityID != st.intent.CityID || r.unitCfgID != st.intent.UnitCfgID || r.count != st.intent.Count ||
		r.food != cost.Food || r.wood != cost.Wood || r.iron != cost.Iron || r.stone != cost.Stone ||
		r.durationSec != st.plan.DurationSeconds() || !bytes.Equal(r.catalogVersion, []byte(st.evidence.Version())) ||
		!bytes.Equal(r.ruleDigest, digest[:]) || !r.acceptedAt.Equal(st.acceptedAt) || !r.startAt.Equal(st.schedule.start) ||
		!r.finishAt.Equal(st.schedule.finish) || r.initialStatus != status {
		return RecruitAcceptance{}, ErrRecruitUnavailable
	}
	r.acceptedAt, r.startAt, r.finishAt = r.acceptedAt.UTC(), r.startAt.UTC(), r.finishAt.UTC()
	return recruitHistoryAcceptance(recruitHistoryQueue{queueID: r.queueID}, r), nil
}
