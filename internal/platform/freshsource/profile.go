// Package freshsource contains startup expectation DATA, not enrollment,
// provenance, authorization, an admission lease or a business success proof.
package freshsource

import "errors"

var ErrProfile = errors.New("freshsource: incomplete source expectations")

// ObjectIdentity describes independent expected catalog identity, not discovery.
type ObjectIdentity struct{ OID, OwnerOID uint32 }

// Profile must come from independently reviewed startup configuration. Matching
// digests prove neither authenticity nor truth of the referenced audit records.
// Domain constructors must validate their exact object inventory, fixed shapes,
// privileges and live source binding; no client/request profile is permitted.
type Profile struct {
	ReleaseDigest, EvidenceDigest                                          [32]byte
	ClusterRef, EvidenceRef                                                string
	DatabaseName, SchemaName, CurrentRoleName, SessionRoleName             string
	DatabaseOID, SchemaOID, SchemaOwnerOID, CurrentRoleOID, SessionRoleOID uint32
	ServerID                                                               int32
	Cohort                                                                 [16]byte
	Objects                                                                map[string]ObjectIdentity
}

// Snapshot rejects structurally incomplete inputs and copies mutable map data.
// It does NOT certify approval, provenance, object semantics or current DB state.
// The returned Profile is still ordinary mutable data, not a capability. Literal
// identifier strings are preserved exactly. Callers must not mutate input maps
// concurrently with this copy; constructors retain their private copy afterward.
func Snapshot(p Profile) (Profile, error) {
	if p.ReleaseDigest == [32]byte{} || p.EvidenceDigest == [32]byte{} ||
		p.ClusterRef == "" || p.EvidenceRef == "" || p.DatabaseName == "" || p.SchemaName == "" ||
		p.CurrentRoleName == "" || p.SessionRoleName == "" || p.DatabaseOID == 0 ||
		p.SchemaOID == 0 || p.SchemaOwnerOID == 0 || p.CurrentRoleOID == 0 || p.SessionRoleOID == 0 ||
		p.ServerID <= 0 || p.Cohort == [16]byte{} || len(p.Objects) == 0 {
		return Profile{}, ErrProfile
	}
	copyObjects := make(map[string]ObjectIdentity, len(p.Objects))
	for name, object := range p.Objects {
		if name == "" || object.OID == 0 || object.OwnerOID == 0 {
			return Profile{}, ErrProfile
		}
		copyObjects[name] = object
	}
	p.Objects = copyObjects
	return p, nil
}
