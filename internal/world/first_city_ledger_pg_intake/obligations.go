package firstcityledgerpgintake

// ObligationEvidence mirrors OID §5 / §6 rows 1–11 plus through-commit drain proof
// for an isolated PG17 test session only. Production pools never inject this struct.
type ObligationEvidence struct {
	ProfileComplete        bool
	InventoryDrainEvidence [11]bool
	ThroughCommitDrainOK   bool

	// SubstituteFence fields exist in real deployments but do NOT authorize intake.
	SubstituteRowLockHeld  bool
	SubstituteDrainCounter int
}

func (e ObligationEvidence) authorized() bool {
	if !e.ProfileComplete || !e.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range e.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func drainAll() ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return ObligationEvidence{
		ProfileComplete:        true,
		InventoryDrainEvidence: inv,
		ThroughCommitDrainOK:   true,
	}
}
