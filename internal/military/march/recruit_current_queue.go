package march

import (
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

const currentRecruitQueueLimit = 64

type CurrentRecruitJob struct {
	QueueID          int64
	UnitCfgID, Count int32
	Status           int16
	FinishAt         time.Time
}

type CurrentRecruitQueue struct {
	Jobs    []CurrentRecruitJob
	HasMore bool
}

// ReadCurrentRecruitQueue projects the current pending prefix after validating
// the complete set. The caller authenticates the actor, pins MIL and holds the
// selected WORLD city barrier. This read cannot advance a job or allocate IDs.
func (p *RecruitParticipant) ReadCurrentRecruitQueue(ctx context.Context, a *recruittx.Access, serverID int32, playerID, cityID int64) (CurrentRecruitQueue, error) {
	var out CurrentRecruitQueue
	if playerID <= 0 || cityID <= 0 {
		return out, ErrRecruitUnavailable
	}
	s, err := p.pinnedRecruitReadSource(ctx, a, serverID)
	if err != nil {
		return out, err
	}
	scope := recruitScope{server: serverID, player: playerID, city: cityID}
	snapshot, err := readRecruitPending(ctx, a, s, scope)
	if err != nil {
		return out, err
	}
	rows, err := snapshot.decodeRows(scope, p.catalog)
	if err != nil {
		return out, err
	}
	if _, err = validateRecruitPending(scope, snapshot.stock, rows, p.catalog); err != nil {
		return out, ErrRecruitUnavailable
	}
	if len(rows) > 0 {
		evidenceScope := RecruitScope{ServerID: serverID, PlayerID: playerID}
		if err = validateRecruitPendingEvidence(ctx, a, s, evidenceScope, cityID, snapshot.ids); err != nil {
			return out, err
		}
	}
	if s.retired.Load() {
		return out, ErrRecruitUnavailable
	}
	out.HasMore = len(rows) > currentRecruitQueueLimit
	for _, row := range rows[:min(len(rows), currentRecruitQueueLimit)] {
		out.Jobs = append(out.Jobs, CurrentRecruitJob{QueueID: row.id, UnitCfgID: row.payload.Unit,
			Count: row.payload.Count, Status: row.status, FinishAt: row.finish})
	}
	return out, nil
}
