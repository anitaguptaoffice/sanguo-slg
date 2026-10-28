package domestic

import (
	"errors"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

var errInvalidFreshTemplate = errors.New("domestic: invalid fresh city template")

// snapshotFreshTemplate validates trusted server configuration and returns an
// isolated snapshot. Callers must not mutate either input concurrently with this
// call. This is only preparation: it provides no authority to create a city.
func snapshotFreshTemplate(initial *CityState, catalog map[int32]BuildingSpec) (*CityState, map[int32]BuildingSpec, error) {
	if initial == nil || initial.ID != 0 || initial.PlayerID <= 0 || initial.Buildings == nil || catalog == nil ||
		len(initial.BuildJobs) != 0 || !initial.LastSettleAt.IsZero() || initial.walletBase != (Resources{}) ||
		initial.walletSaved || initial.nextJobID != 0 || initial.productionRemainder != ([4]int64{}) ||
		!freshResourcesValid(initial.Wallet) {
		return nil, nil, errInvalidFreshTemplate
	}
	copyCatalog := make(map[int32]BuildingSpec, len(catalog))
	for id, spec := range catalog {
		if id <= 0 || spec.ID != id || spec.BaseTimeSec <= 0 || spec.BaseTimeSec > math.MaxInt64/int64(time.Second) ||
			!freshResourcesValid(spec.BaseCost) || spec.ProdPerHour < 0 || spec.ProdRes < 0 || spec.ProdRes >= 4 {
			return nil, nil, errInvalidFreshTemplate
		}
		copyCatalog[id] = spec
	}
	for slot, building := range initial.Buildings {
		// PostgreSQL varchar(32) counts characters, not bytes; text cannot contain NUL.
		if slot == "" || !utf8.ValidString(slot) || strings.ContainsRune(slot, 0) || utf8.RuneCountInString(slot) > 32 ||
			building == nil || building.CfgID <= 0 || building.Level <= 0 {
			return nil, nil, errInvalidFreshTemplate
		}
		if _, ok := copyCatalog[building.CfgID]; !ok {
			return nil, nil, errInvalidFreshTemplate
		}
	}
	copyCity := *initial
	copyCity.Buildings = make(map[string]*BuildingInstance, len(initial.Buildings))
	for slot, building := range initial.Buildings {
		b := *building
		copyCity.Buildings[slot] = &b
	}
	if initial.BuildJobs != nil {
		copyCity.BuildJobs = make([]*BuildJob, 0)
	}
	return &copyCity, copyCatalog, nil
}

func freshResourcesValid(r Resources) bool {
	return r.Food >= 0 && r.Wood >= 0 && r.Stone >= 0 && r.Iron >= 0
}
