package domestic

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Allocation belongs to the wallet/job transaction, not the published CityState.
func (p *PGStore) startBuildingUpgrade(ctx context.Context, sid int32, c *CityState, cat map[int32]BuildingSpec, now time.Time, slot string, cfgID int32) (UpgradeResult, *BuildJob, error) {
	binding, err := p.bindQueueIdentity(ctx, sid)
	if err != nil {
		return UpgradeResult{}, nil, err
	}
	var result UpgradeResult
	var job *BuildJob
	err = p.saveCityInTx(ctx, sid, c, cat, now, func(work *CityState, tx pgx.Tx) error {
		settleProduction(work, cat, now)
		var err error
		result, job, err = startUpgradeWithAllocator(work, cat, now, slot, cfgID, func() (int64, error) { return p.allocateQueueID(ctx, tx, binding) })
		return err
	}, false, nil)
	if err != nil {
		return UpgradeResult{}, nil, err
	}
	return result, job, nil
}
