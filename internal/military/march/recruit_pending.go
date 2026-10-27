package march

import (
	"errors"
	"math"
	"time"
)

var errRecruitPending = errors.New("march: inconsistent recruit pending input")

// Private copied inputs, not authenticated scope or source/epoch capabilities.
type recruitScope struct {
	server       int32
	player, city int64
}
type recruitStockRow struct {
	server         int32
	city           int64
	unit           int32
	ready, wounded int64
}
type recruitPendingRow struct {
	scope         recruitScope
	id            int64
	kind, status  int16
	payload       recruitPayload
	start, finish time.Time
}

type recruitPendingSummary struct {
	reserved                  [4]int64
	activeID, oldestWaitingID int64
	valid                     bool // arithmetic validation only, not authority or SQL completeness
}

// validateRecruitPending checks ALL SUPPLIED snapshots, never SQL completeness.
// The future adapter must separately prove locked complete input, WORLD/marker
// ownership, source/epoch/writer fences and receipt/origin history/bijection.
// Retained terminal rows belong to all-state audit/history, not this pending set.
func validateRecruitPending(scope recruitScope, stock []recruitStockRow, rows []recruitPendingRow, catalog *RecruitCatalog) (recruitPendingSummary, error) {
	var out recruitPendingSummary
	if scope.server <= 0 || scope.player <= 0 || scope.city <= 0 || len(stock) != 4 || catalog == nil || len(catalog.manifests) == 0 {
		return out, errRecruitPending
	}
	var seen [4]bool
	for _, row := range stock {
		if row.server != scope.server || row.city != scope.city || row.unit < 1 || row.unit > 4 ||
			row.ready < 0 || row.ready > math.MaxInt32 || row.wounded < 0 || row.wounded > math.MaxInt32 {
			return recruitPendingSummary{}, errRecruitPending
		}
		i := row.unit - 1
		if seen[i] {
			return recruitPendingSummary{}, errRecruitPending
		}
		seen[i] = true
		out.reserved[i] = row.ready // wounded never reserves completion capacity
	}
	var previous int64
	for i, row := range rows {
		if row.scope != scope || row.kind != 3 || row.id <= previous || row.id > 9007199254740991 ||
			(i == 0 && row.status != 1) || (i > 0 && row.status != 0) || row.payload.validate(catalog) != nil {
			return recruitPendingSummary{}, errRecruitPending
		}
		finish, err := recruitFinish(row.start, row.payload.Seconds)
		if err != nil || !validRecruitTime(row.finish) || !row.finish.Equal(finish) {
			return recruitPendingSummary{}, errRecruitPending
		}
		unit := row.payload.Unit - 1
		count := int64(row.payload.Count)
		if count > math.MaxInt32-out.reserved[unit] {
			return recruitPendingSummary{}, errRecruitPending
		}
		out.reserved[unit] += count
		previous = row.id
		if i == 0 {
			out.activeID = row.id
		}
		if i == 1 {
			out.oldestWaitingID = row.id
		}
	}
	out.valid = true
	return out, nil
}

// canAddCount preserves representable completion capacity, not a gameplay cap.
// Passing this check does not authorize admission or mutate these copied totals.
func (s recruitPendingSummary) canAddCount(unit, count int32) error {
	if !s.valid || unit < 1 || unit > 4 || count <= 0 || int64(count) > math.MaxInt32-s.reserved[unit-1] {
		return errRecruitPending
	}
	return nil
}
