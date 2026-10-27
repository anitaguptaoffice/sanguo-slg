package march

import (
	"errors"
	"math"
	"time"
)

var errRecruitCompletionPlan = errors.New("march: invalid recruit completion input")

type recruitCompletionDisposition uint8

const (
	recruitCompletionInvalid recruitCompletionDisposition = iota
	recruitCompletionWaiting
	recruitCompletionEarly
	recruitCompletionDue
)

// Value-only proposal, not a commit result or mutation capability. A future
// participant must re-read under locks and apply conditional writes in ONE tx.
type recruitCompletionPlan struct {
	disposition                         recruitCompletionDisposition
	targetID, doneID, promotionID       int64
	creditUnit, creditCount, readyAfter int32
	promotion                           recruitSchedule
}

// Missing/done history is deliberately not inferred from a pending snapshot.
// Complete supplied inputs still do not prove SQL completeness/auth/source,
// marker/epoch fences, receipt linkage or legal historical transitions.
func planRecruitCompletion(scope recruitScope, stock []recruitStockRow, rows []recruitPendingRow, catalog *RecruitCatalog, targetID int64, sample time.Time) (recruitCompletionPlan, error) {
	summary, err := validateRecruitPending(scope, stock, rows, catalog)
	if err != nil || targetID <= 0 || targetID > 9007199254740991 {
		return recruitCompletionPlan{}, errRecruitCompletionPlan
	}
	now, err := canonicalRecruitTime(sample)
	if err != nil {
		return recruitCompletionPlan{}, errRecruitCompletionPlan
	}
	found := false
	for _, row := range rows {
		if row.id == targetID {
			found = true
			break
		}
	}
	if !found {
		return recruitCompletionPlan{}, errRecruitCompletionPlan
	}
	if targetID != summary.activeID {
		return recruitCompletionPlan{disposition: recruitCompletionWaiting, targetID: targetID}, nil
	}
	active := rows[0]
	if active.finish.After(now) {
		return recruitCompletionPlan{disposition: recruitCompletionEarly, targetID: targetID}, nil
	}
	// Validate the successor before offering any credit/done effect.
	var promotion recruitSchedule
	if summary.oldestWaitingID != 0 {
		promotion, err = planRecruitPromotion(now, rows[1].payload.Seconds)
		if err != nil {
			return recruitCompletionPlan{}, errRecruitCompletionPlan
		}
	}
	var readyAfter int32
	for _, row := range stock {
		if row.unit == active.payload.Unit {
			if int64(active.payload.Count) > math.MaxInt32-row.ready {
				return recruitCompletionPlan{}, errRecruitCompletionPlan
			}
			readyAfter = int32(row.ready + int64(active.payload.Count))
		}
	}
	return recruitCompletionPlan{disposition: recruitCompletionDue, targetID: targetID, doneID: targetID,
		promotionID: summary.oldestWaitingID, creditUnit: active.payload.Unit, creditCount: active.payload.Count,
		readyAfter: readyAfter, promotion: promotion}, nil
}
