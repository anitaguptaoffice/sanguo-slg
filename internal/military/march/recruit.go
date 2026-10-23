package march

import (
	"errors"
	"fmt"
	"time"
)

var (
	ErrInvalidCount     = errors.New("march: recruit count must be positive")
	ErrUnknownUnit      = errors.New("march: unknown unit_cfg_id")
	ErrInsufficientRes  = errors.New("march: insufficient resources")
	ErrJobNotFound      = errors.New("march: recruit job not found")
	ErrCityNotFound     = errors.New("march: city not found")
)

// RecruitSlots is the default concurrent recruit jobs per city (M1).
const RecruitSlots = 1

// RecruitRequest is input for starting recruitment.
type RecruitRequest struct {
	CityID    int64
	UnitCfgID int32
	Count     int32
}

// RecruitResult is returned after resources are deducted and the job is queued.
type RecruitResult struct {
	JobID      int64
	QueueID    int64 // same as JobID for API compatibility
	FinishAt   time.Time
	Wallet     Resources
	InProgress bool
}

// recruitDuration returns total training time for count units.
func recruitDuration(spec UnitSpec, count int32) time.Duration {
	if count <= 0 {
		return 0
	}
	return time.Duration(spec.SecPerUnit*int64(count)) * time.Second
}

func activeRecruitCount(jobs []*RecruitJob) int {
	n := 0
	for _, j := range jobs {
		if j.Status == QueueActive {
			n++
		}
	}
	return n
}

func lastFinishAt(jobs []*RecruitJob) time.Time {
	var t time.Time
	for _, j := range jobs {
		if j.Status == QueueWaiting || j.Status == QueueActive {
			if j.FinishAt.After(t) {
				t = j.FinishAt
			}
		}
	}
	return t
}

// StartRecruit deducts resources and enqueues a recruit job on city.
// finish scheduling is handled by Hub via the scheduler.
func StartRecruit(
	city *CityState,
	catalog map[int32]UnitSpec,
	now time.Time,
	req RecruitRequest,
) (RecruitResult, *RecruitJob, error) {
	if req.Count <= 0 {
		return RecruitResult{}, nil, ErrInvalidCount
	}
	spec, ok := catalog[req.UnitCfgID]
	if !ok {
		return RecruitResult{}, nil, ErrUnknownUnit
	}
	cost := spec.RecruitCost.Scale(req.Count)
	wallet := city.Wallet
	if !wallet.Sub(cost) {
		return RecruitResult{}, nil, ErrInsufficientRes
	}
	city.Wallet = wallet

	city.nextJobID++
	job := &RecruitJob{
		ID:        city.nextJobID,
		UnitCfgID: req.UnitCfgID,
		Count:     req.Count,
		CostPaid:  cost,
		Status:    QueueWaiting,
	}
	dur := recruitDuration(spec, req.Count)

	active := activeRecruitCount(city.RecruitJobs)
	if active < RecruitSlots {
		job.Status = QueueActive
		job.StartAt = now
		job.FinishAt = now.Add(dur)
	} else {
		base := lastFinishAt(city.RecruitJobs)
		if base.Before(now) {
			base = now
		}
		job.StartAt = base
		job.FinishAt = base.Add(dur)
	}
	city.RecruitJobs = append(city.RecruitJobs, job)

	return RecruitResult{
		JobID:      job.ID,
		QueueID:    job.ID,
		FinishAt:   job.FinishAt,
		Wallet:     city.Wallet,
		InProgress: job.Status == QueueActive,
	}, job, nil
}

// CompleteRecruit applies finished troops and advances the FIFO queue.
// If a waiting job becomes active, it is returned for scheduling.
func CompleteRecruit(city *CityState, catalog map[int32]UnitSpec, jobID int64, now time.Time) (*RecruitJob, error) {
	var job *RecruitJob
	for _, j := range city.RecruitJobs {
		if j.ID == jobID {
			job = j
			break
		}
	}
	if job == nil {
		return nil, ErrJobNotFound
	}
	if job.Status != QueueActive {
		return nil, fmt.Errorf("march: job %d not active", jobID)
	}
	job.Status = QueueDone
	if city.Troops == nil {
		city.Troops = make(map[int32]int32)
	}
	city.Troops[job.UnitCfgID] += job.Count

	var promoted *RecruitJob
	for _, j := range city.RecruitJobs {
		if j.Status != QueueWaiting {
			continue
		}
		spec, ok := catalog[j.UnitCfgID]
		if !ok {
			continue
		}
		if activeRecruitCount(city.RecruitJobs) < RecruitSlots {
			j.Status = QueueActive
			j.StartAt = now
			j.FinishAt = now.Add(recruitDuration(spec, j.Count))
			promoted = j
			break
		}
	}
	return promoted, nil
}
