package recruittx

import "context"

// CheckSameTransaction checks shared transaction identity and active lifetime,
// not source metadata, business authorization or lasting readiness. Callers that
// retain a handle must keep a private value snapshot, not caller-writable memory.
// Same-state aliases are valid; another Begin on the same Binding is not.
// No SQL or transaction lifecycle operation is performed.
func (a *Access) CheckSameTransaction(ctx context.Context, expected *Binding, other *Access) error {
	if other == nil || other.s == nil {
		return ErrBinding
	}
	_, leave, err := a.enter(ctx, expected)
	if err != nil {
		return err
	}
	defer leave()
	if a.s != other.s {
		return ErrBinding
	}
	return nil
}
