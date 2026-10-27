package march

import (
	"errors"
	"math"
	"time"
)

var errRecruitSchedule = errors.New("march: invalid recruit schedule")

// recruitSchedule is arithmetic, not an accepted receipt or queue capability.
// Its zero value is invalid; consume only results with a nil error.
type recruitSchedule struct {
	start, finish time.Time
	waiting       bool
}

// canonicalRecruitTime floors a supplied processing sample, not a stored value.
// A future participant must sample database clock_timestamp only after locks.
func canonicalRecruitTime(sample time.Time) (time.Time, error) {
	utc := sample.UTC()
	if utc.Year() < 1 || utc.Year() > 9999 {
		return time.Time{}, errRecruitSchedule
	}
	// Calendar arithmetic avoids UnixNano's narrower representable date range.
	return utc.Truncate(time.Millisecond), nil
}

func validRecruitTime(value time.Time) bool {
	_, offset := value.Zone()
	return offset == 0 && value.Year() >= 1 && value.Year() <= 9999 &&
		value.Nanosecond()%int(time.Millisecond) == 0
}

func recruitFinish(start time.Time, seconds int64) (time.Time, error) {
	if !validRecruitTime(start) || seconds <= 0 || seconds > math.MaxInt64/int64(time.Second) {
		return time.Time{}, errRecruitSchedule
	}
	finish := start.UTC().Add(time.Duration(seconds) * time.Second)
	if !validRecruitTime(finish) || !finish.After(start) {
		return time.Time{}, errRecruitSchedule
	}
	return finish, nil
}

// planRecruitSchedule requires ALL validated pending finishes. It does not prove
// that this slice is complete or that owner, FIFO, payload and capacity are valid.
// Never pass an unvalidated SQL subset and treat this result as admission proof.
func planRecruitSchedule(sample time.Time, seconds int64, pendingFinishes []time.Time) (recruitSchedule, error) {
	start, err := canonicalRecruitTime(sample)
	if err != nil {
		return recruitSchedule{}, err
	}
	for _, finish := range pendingFinishes {
		if !validRecruitTime(finish) {
			return recruitSchedule{}, errRecruitSchedule
		}
		if finish.After(start) {
			start = finish.UTC()
		}
	}
	finish, err := recruitFinish(start, seconds)
	if err != nil {
		return recruitSchedule{}, err
	}
	return recruitSchedule{start: start, finish: finish, waiting: len(pendingFinishes) > 0}, nil
}

// Promotion starts at the new processing sample with stored integral duration;
// accepted estimates and younger waiting jobs must not be rewritten by callers.
func planRecruitPromotion(sample time.Time, storedSeconds int64) (recruitSchedule, error) {
	return planRecruitSchedule(sample, storedSeconds, nil)
}
