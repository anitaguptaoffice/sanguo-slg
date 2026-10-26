package hero

// Injection plans support only the existing exported GM/test seams; they do not
// wire a new source of offers or captives. API/maintenance owner must authorize
// injection and create Hero plus insert-only metadata in one locked transaction.
type ComingInjectionPlan struct {
	Hero   *Hero
	Record ComingRecord
}

type CaptiveInjectionPlan struct {
	Hero   *Hero
	Record CaptiveRecord
}

func (s *Service) PlanComingInjection(p PlayerRef, in InjectComingInput) (ComingInjectionPlan, error) {
	if s == nil || p.ServerID <= 0 || p.PlayerID <= 0 {
		return ComingInjectionPlan{}, ErrInvalidFamilyState
	}
	if in.CityID <= 0 {
		return ComingInjectionPlan{}, ErrInvalidRecruit
	}
	loyalty := in.Loyalty
	if loyalty <= 0 {
		loyalty = 70
	}
	h := &Hero{ServerID: p.ServerID, PlayerID: p.PlayerID,
		TemplateCfgID: in.TemplateCfgID, DisplayName: in.DisplayName,
		Level: in.Level, Loyalty: loyalty, Force: in.Force, Intel: in.Intel,
		Politics: in.Politics, Command: in.Command, Status: StatusComing, CreatedAt: s.now()}
	if h.Level < 1 {
		h.Level = 1
	}
	return ComingInjectionPlan{Hero: h, Record: ComingRecord{CityID: in.CityID}}, nil
}

func (s *Service) PlanCaptiveInjection(p PlayerRef, in InjectCaptiveInput) (CaptiveInjectionPlan, error) {
	if s == nil || p.ServerID <= 0 || p.PlayerID <= 0 {
		return CaptiveInjectionPlan{}, ErrInvalidFamilyState
	}
	if in.CityID <= 0 {
		return CaptiveInjectionPlan{}, ErrInvalidRecruit
	}
	loyalty := in.Loyalty
	if loyalty <= 0 {
		loyalty = 50
	}
	h := &Hero{ServerID: p.ServerID, PlayerID: p.PlayerID,
		TemplateCfgID: in.TemplateCfgID, DisplayName: in.DisplayName,
		Level: in.Level, Loyalty: loyalty, Force: in.Force, Intel: in.Intel,
		Politics: in.Politics, Command: in.Command, Status: StatusCaptive, CreatedAt: s.now()}
	if h.Level < 1 {
		h.Level = 1
	}
	rec := CaptiveRecord{CityID: in.CityID}
	ensureSummonRequirements(h, &rec)
	return CaptiveInjectionPlan{Hero: h, Record: rec}, nil
}
