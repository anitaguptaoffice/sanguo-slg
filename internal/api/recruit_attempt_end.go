package api

import (
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// end reuses admission's concrete cleanup and bookkeeping. The actual method
// must recover directly in its defer and pass that value here, not defer end.
func (a *recruitAttempt) end(lease freshLease, owner *recruittx.Owner, phase string, began bool, r *recruitAttemptResult, fault any) {
	var cleanupFault any
	if fault != nil {
		r.cause = errors.Join(r.cause, fmt.Errorf("recruit attempt panic at %s: %v", phase, fault))
	}
	retire := recruitAttemptCloses(r.cause)
	if r.outcome != recruitConfirmed {
		unknown := errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || phase == "commit" && fault != nil
		if owner != nil {
			r.cleanup, cleanupFault = rollbackRecruitValidation(owner)
		}
		r.outcome = recruitKnownEnded
		if unknown || began && (owner == nil || r.cleanup != nil) {
			r.outcome = recruitUnknown
		}
	}
	a.finish(lease, phase, r, retire, fault, cleanupFault)
	panicRecruitAttempt(fault, cleanupFault)
}

// Bookkeeping must precede propagation, and cleanup cannot replace the original.
func panicRecruitAttempt(fault, cleanupFault any) {
	if fault != nil {
		panic(fault)
	}
	if cleanupFault != nil {
		panic(cleanupFault)
	}
}
