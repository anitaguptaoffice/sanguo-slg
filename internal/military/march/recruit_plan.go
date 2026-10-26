package march

import (
	"errors"
	"math"
	"time"
)

var (
	ErrInvalidRecruitSpec = errors.New("march: invalid recruit specification")
	ErrRecruitOverflow    = errors.New("march: recruit arithmetic overflow")
)

// RecruitPlan is a copied, immutable cost/duration calculation, not authorization
// or durable acceptance. Its zero value is invalid; use only a nil-error result.
type RecruitPlan struct {
	request         RecruitRequest
	cost            Resources
	durationSeconds int64
	duration        time.Duration
}

func (p RecruitPlan) Request() RecruitRequest { return p.request }
func (p RecruitPlan) Cost() Resources         { return p.cost }
func (p RecruitPlan) DurationSeconds() int64  { return p.durationSeconds }
func (p RecruitPlan) Duration() time.Duration { return p.duration }

// PlanRecruit computes server-rule cost and duration without side effects. It
// validates only count and the selected specification; CityID is opaque context.
// The catalog owner must prevent concurrent writes during calls. No catalog
// reference is retained. This dormant helper does not change the live recruit path.
func PlanRecruit(catalog map[int32]UnitSpec, req RecruitRequest) (RecruitPlan, error) {
	if req.Count <= 0 {
		return RecruitPlan{}, ErrInvalidCount
	}
	spec, ok := catalog[req.UnitCfgID]
	if !ok {
		return RecruitPlan{}, ErrUnknownUnit
	}
	cost := spec.RecruitCost
	if spec.UnitCfgID != req.UnitCfgID || spec.SecPerUnit <= 0 ||
		cost.Food < 0 || cost.Wood < 0 || cost.Iron < 0 || cost.Stone < 0 {
		return RecruitPlan{}, ErrInvalidRecruitSpec
	}
	n := int64(req.Count)
	limit := int64(math.MaxInt64) / n
	if cost.Food > limit || cost.Wood > limit || cost.Iron > limit ||
		cost.Stone > limit || spec.SecPerUnit > limit {
		return RecruitPlan{}, ErrRecruitOverflow
	}
	seconds := spec.SecPerUnit * n
	if seconds > math.MaxInt64/int64(time.Second) {
		return RecruitPlan{}, ErrRecruitOverflow
	}
	return RecruitPlan{
		request: req,
		cost: Resources{
			Food: cost.Food * n, Wood: cost.Wood * n,
			Iron: cost.Iron * n, Stone: cost.Stone * n,
		},
		durationSeconds: seconds,
		duration:        time.Duration(seconds) * time.Second,
	}, nil
}
