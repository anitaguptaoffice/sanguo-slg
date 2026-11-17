package domestic

import "maps"

// templateCatalog reads only constructor captures. Wiring drift is detected by
// Pin/Prepare, not by reading today's Hub from a data-only operation. Retirement
// is shared, but this check is neither admission nor proof of completed drain.
func (p *FreshCityParticipant) templateCatalog() (map[int32]BuildingSpec, error) {
	if p == nil || p.state == nil {
		return nil, errFreshSource
	}
	s := p.state
	if s.retired.Load() || s.binding == nil || s.hub == nil || s.store == nil ||
		s.pool == nil || s.profile.ServerID <= 0 || s.catalog == nil || len(s.catalog) > freshTemplateMaxRecords {
		return nil, errFreshSource
	}
	return s.catalog, nil
}

// CaptureTemplate returns isolated FCT1 data using the complete captured catalog.
// APP must match its retained semantic manifest and full bytes before intake.
// No lease, transaction, Hub gate, catalog replacement or business proof is made.
func (p *FreshCityParticipant) CaptureTemplate(initial *CityState, versions FreshTemplateVersions) (FreshTemplateContent, error) {
	catalog, err := p.templateCatalog()
	if err != nil {
		return FreshTemplateContent{}, err
	}
	content, err := encodeFreshTemplate(initial, catalog, versions)
	if err != nil {
		return FreshTemplateContent{}, err
	}
	if p.state.retired.Load() {
		return FreshTemplateContent{}, errFreshSource
	}
	return content, nil
}

// RestoreTemplate reconstructs isolated positive-player data only when every
// retained catalog field matches the constructor capture, including unused IDs.
// History/result reads use pure ValidateFreshTemplateContent instead. APP still
// owns semantic support, authentication, lease and Prepare before effect Begin.
func (p *FreshCityParticipant) RestoreTemplate(content FreshTemplateContent, playerID int64) (*CityState, error) {
	catalog, err := p.templateCatalog()
	if err != nil {
		return nil, err
	}
	city, retained, err := decodeFreshTemplate(content, playerID)
	if err != nil {
		return nil, err
	}
	if !maps.Equal(catalog, retained) || p.state.retired.Load() {
		return nil, errFreshSource
	}
	return city, nil
}
