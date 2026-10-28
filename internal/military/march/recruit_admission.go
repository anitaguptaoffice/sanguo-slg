package march

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// ErrRecruitUnsupportedVersion is an eligible-absence unsupported version after evidence validation; transport maps it to 10001.
var ErrRecruitUnsupportedVersion = errors.New("march: unsupported recruit intent version")

type recruitAdmissionState struct {
	participant *RecruitParticipant
	access      recruittx.Access
	scope       RecruitScope
	intent      RecruitIntent
	queueID     int64
	plan        RecruitPlan
	evidence    RecruitRuleEvidence
	schedule    recruitSchedule
	cost        Resources
	acceptedAt  time.Time
	used        atomic.Bool
}

type RecruitAdmission struct{ state *recruitAdmissionState }

func (h *RecruitAdmission) Cost(ctx context.Context, a *recruittx.Access) (Resources, error) {
	if h == nil || h.state == nil {
		return Resources{}, ErrRecruitUnavailable
	}
	st, p := h.state, h.state.participant
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || st.used.Load() || !st.evidence.valid || !validRecruitTime(st.acceptedAt) || st.queueID < 1 || st.queueID > 9007199254740991 || st.plan.DurationSeconds() <= 0 || !validRecruitTime(st.schedule.start) || !validRecruitTime(st.schedule.finish) {
		return Resources{}, ErrRecruitUnavailable
	}
	if err := a.CheckSameTransaction(ctx, p.source.binding, &st.access); err != nil {
		return Resources{}, errors.Join(ErrRecruitUnavailable, err)
	}
	if p.source.retired.Load() || st.used.Load() {
		return Resources{}, ErrRecruitUnavailable
	}
	return st.cost, nil
}
