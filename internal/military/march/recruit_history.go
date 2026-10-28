package march

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// RecruitAcceptance is immutable historical fact copied from one committed
// receipt, never a current wallet, stock or readiness snapshot.
type RecruitAcceptance struct {
	QueueID, CityID                 int64
	UnitCfgID, Count                int32
	Cost                            Resources
	DurationSeconds                 int64
	CatalogVersion                  string
	RuleDigest                      [32]byte
	AcceptedAt                      time.Time
	InitialStatus                   int16
	InitialStartAt, InitialFinishAt time.Time
}

type recruitHistoryQueue struct {
	serverID          int32
	queueID, playerID int64
	cityID            *int64
	queueType, status int16
	payload           []byte
	startAt, finishAt time.Time
}

type recruitHistoryReceipt struct {
	serverID, queueID, cityID            int64
	unitCfgID, count                     int32
	food, wood, iron, stone, durationSec int64
	catalogVersion, ruleDigest           []byte
	acceptedAt, startAt, finishAt        time.Time
	intentVersion, initialStatus         int16
}

// History locks queue then receipt, re-reads origin/queue/receipt, and returns
// only fully verified acceptance without city/stock locks or mutation.
func (p *RecruitParticipant) History(ctx context.Context, a *recruittx.Access, scope RecruitScope, intent RecruitIntent, queueID int64) (RecruitAcceptance, error) {
	var zero RecruitAcceptance
	if !validRecruitHistoryQueueID(queueID) {
		return zero, ErrRecruitUnavailable
	}
	s, err := p.recruitLookup(ctx, a, scope)
	if err != nil {
		return zero, err
	}
	var q recruitHistoryQueue
	if err = recruitHistoryRead(ctx, a, s, recruitHistorySQL(s, "work_queue", historyQueueCols, " FOR UPDATE"), []any{scope.ServerID, queueID},
		&q.serverID, &q.queueID, &q.playerID, &q.cityID, &q.queueType, &q.payload, &q.startAt, &q.finishAt, &q.status); err != nil {
		return zero, err
	}
	var r recruitHistoryReceipt
	if err = recruitHistoryRead(ctx, a, s, recruitHistorySQL(s, "mil_recruit_receipt", historyReceiptCols, " FOR UPDATE"), []any{scope.ServerID, queueID},
		&r.serverID, &r.queueID, &r.intentVersion, &r.cityID, &r.unitCfgID, &r.count, &r.food, &r.wood,
		&r.iron, &r.stone, &r.durationSec, &r.catalogVersion, &r.ruleDigest, &r.acceptedAt, &r.startAt, &r.finishAt, &r.initialStatus); err != nil {
		return zero, err
	}
	playerID, operation, command := int64(0), int16(0), []byte(nil)
	if err = recruitHistoryRead(ctx, a, s, recruitHistorySQL(s, "mil_recruit_origin", historyOriginCols, ""), []any{scope.ServerID, queueID}, &playerID, &operation, &command); err != nil {
		return zero, err
	}
	// pgx yields timestamptz in process location; stored instants are UTC millis.
	q.startAt, q.finishAt = q.startAt.UTC(), q.finishAt.UTC()
	r.acceptedAt, r.startAt, r.finishAt = r.acceptedAt.UTC(), r.startAt.UTC(), r.finishAt.UTC()
	if q.serverID != scope.ServerID || q.queueID != queueID || q.playerID != scope.PlayerID || q.cityID == nil ||
		q.queueType != 3 || r.serverID != int64(scope.ServerID) || r.queueID != queueID || r.cityID != *q.cityID ||
		r.intentVersion != 1 || (r.initialStatus != 0 && r.initialStatus != 1) ||
		playerID != scope.PlayerID || operation != 1 || !bytes.Equal(command, scope.CommandID[:]) {
		return zero, ErrRecruitUnavailable
	}
	// Only the four typed intent fields are caller input. A same-key accepted
	// record with different input is conflict even if retained or current
	// catalog evidence is unavailable; corrupt linkage remains unavailable.
	if intent.Version != uint32(r.intentVersion) || intent.CityID != r.cityID ||
		intent.UnitCfgID != r.unitCfgID || intent.Count != r.count {
		return zero, ErrRecruitConflict
	}
	payload, err := decodeRecruitPayload(q.payload, p.catalog)
	if err != nil || payload.Unit != r.unitCfgID || payload.Count != r.count ||
		payload.Cost != (recruitPayloadCost{Food: r.food, Wood: r.wood, Iron: r.iron, Stone: r.stone}) ||
		payload.Seconds != r.durationSec || payload.Catalog != string(r.catalogVersion) ||
		payload.Digest != hex.EncodeToString(r.ruleDigest) || !recruitHistoryEvolution(q, r) {
		return zero, ErrRecruitUnavailable
	}
	return recruitHistoryAcceptance(q, r), nil
}

func recruitHistoryRead(ctx context.Context, a *recruittx.Access, s *freshMilitarySource, query string, args []any, dest ...any) error {
	err := a.Scan(ctx, s.binding, query, args, dest...)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrRecruitUnavailable
	}
	if err != nil {
		return errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	return nil
}

func validRecruitHistoryQueueID(queueID int64) bool {
	return queueID >= 1 && queueID <= 9007199254740991
}

// recruitHistoryEvolution accepts only the frozen waiting->active->done path.
// Always-active jobs keep their accepted schedule; promoted jobs keep exactly
// one actual schedule of stored duration. No current-time or owner check.
func recruitHistoryEvolution(q recruitHistoryQueue, r recruitHistoryReceipt) bool {
	if q.cityID == nil || r.durationSec <= 0 || !validRecruitTime(q.startAt) || !validRecruitTime(q.finishAt) ||
		!validRecruitTime(r.acceptedAt) || !validRecruitTime(r.startAt) || !validRecruitTime(r.finishAt) {
		return false
	}
	finish, err := recruitFinish(r.startAt, r.durationSec)
	if err != nil || !finish.Equal(r.finishAt) {
		return false
	}
	switch r.initialStatus {
	case 1:
		if !r.startAt.Equal(r.acceptedAt) || (q.status != 1 && q.status != 2) {
			return false
		}
		return q.startAt.Equal(r.startAt) && q.finishAt.Equal(r.finishAt)
	case 0:
		if r.startAt.Before(r.acceptedAt) {
			return false
		}
		if q.status == 0 {
			return q.startAt.Equal(r.startAt) && q.finishAt.Equal(r.finishAt)
		}
		if q.status != 1 && q.status != 2 {
			return false
		}
		actual, err := recruitFinish(q.startAt, r.durationSec)
		return err == nil && actual.Equal(q.finishAt) && !q.startAt.Before(r.acceptedAt)
	default:
		return false
	}
}

func recruitHistoryAcceptance(q recruitHistoryQueue, r recruitHistoryReceipt) RecruitAcceptance {
	var digest [32]byte
	copy(digest[:], r.ruleDigest)
	return RecruitAcceptance{
		QueueID: q.queueID, CityID: r.cityID, UnitCfgID: r.unitCfgID, Count: r.count,
		Cost:            Resources{Food: r.food, Wood: r.wood, Iron: r.iron, Stone: r.stone},
		DurationSeconds: r.durationSec, CatalogVersion: string(r.catalogVersion), RuleDigest: digest,
		AcceptedAt: r.acceptedAt, InitialStatus: r.initialStatus, InitialStartAt: r.startAt, InitialFinishAt: r.finishAt,
	}
}

const (
	historyQueueCols   = `server_id,queue_id,player_id,city_id,queue_type,payload,start_at,finish_at,status`
	historyReceiptCols = `server_id,queue_id,intent_version,city_id,unit_cfg_id,count,food_paid,wood_paid,iron_paid,stone_paid,duration_sec,catalog_version,rule_digest,accepted_at,initial_start_at,initial_finish_at,initial_status`
	historyOriginCols  = `player_id,operation,command_id`
)

func recruitHistorySQL(s *freshMilitarySource, table, cols, suffix string) string {
	return `SELECT ` + cols + ` FROM ` + pgx.Identifier{s.profile.SchemaName, table}.Sanitize() +
		` WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_id OPERATOR(pg_catalog.=) $2` + suffix
}
