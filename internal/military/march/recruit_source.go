package march

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// RecruitParticipant captures consistency expectations, not source approval or provenance.
// Copies share retirement; the caller owns transaction lifetime and external fences.
type RecruitParticipant struct {
	source  *freshMilitarySource
	catalog *RecruitCatalog
}

func NewRecruitParticipant(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile, catalog *RecruitCatalog) (*RecruitParticipant, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || b == nil || a == nil || catalog == nil || len(p.Objects) != 14 {
		return nil, ErrFreshCitySource
	}
	seen := make(map[uint32]bool, 14)
	for _, names := range [][]string{freshBaseNames[:], freshQueueNames[:], freshRetainedNames[:], {"work_queue_id_seq"}} {
		for _, name := range names {
			obj, ok := p.Objects[name]
			if !ok || seen[obj.OID] {
				return nil, ErrFreshCitySource
			}
			seen[obj.OID] = true
		}
	}
	records := make([]RecruitManifest, 0, len(catalog.manifests))
	for version, rules := range catalog.manifests {
		records = append(records, RecruitManifest{Version: version, Rules: rules})
	}
	snapshot, err := NewRecruitCatalog(records, catalog.current)
	if err != nil {
		return nil, err
	}
	s := &freshMilitarySource{binding: b, profile: p}
	access := *a
	if err := validateRecruitSource(ctx, &access, s); err != nil {
		return nil, err
	}
	return &RecruitParticipant{source: s, catalog: snapshot}, nil
}

// Pin locks only the five MIL relations, in frozen order, and revalidates metadata.
func (p *RecruitParticipant) Pin(ctx context.Context, a *recruittx.Access) error {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() {
		return ErrFreshCitySource
	}
	s := p.source
	access := *a
	for _, name := range []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt"} {
		_, err := access.Exec(ctx, s.binding, "LOCK TABLE ONLY "+pgx.Identifier{s.profile.SchemaName, name}.Sanitize()+" IN ROW EXCLUSIVE MODE")
		if err != nil {
			return s.failure(err)
		}
	}
	err := s.failure(validateRecruitSource(ctx, &access, s))
	if err == nil && s.retired.Load() {
		return ErrFreshCitySource
	}
	return err
}

func validateRecruitSource(ctx context.Context, a *recruittx.Access, s *freshMilitarySource) error {
	for _, check := range []func(context.Context, *recruittx.Access, *recruittx.Binding, freshsource.Profile) error{validateFreshMilitaryBase, validateFreshMilitaryQueue, validateFreshMilitaryRetained} {
		if err := check(ctx, a, s.binding, s.profile); err != nil {
			return err
		}
	}
	seq := s.profile.Objects["work_queue_id_seq"]
	var valid bool
	if err := a.Scan(ctx, s.binding, freshMilitarySequence, []any{seq.OID, seq.OwnerOID, s.profile.SchemaOID}, &valid); err != nil {
		return err
	}
	if !valid {
		return ErrFreshCitySource
	}
	var last int64
	var called bool
	if err := a.Scan(ctx, s.binding, "SELECT last_value,is_called FROM "+pgx.Identifier{s.profile.SchemaName, "work_queue_id_seq"}.Sanitize(), nil, &last, &called); err != nil {
		return err
	}
	// Exhaustion is valid historical source state; allocation readiness belongs to Prepare.
	if last < 1 || last > 9007199254740991 {
		return ErrFreshCitySource
	}
	if err := a.Scan(ctx, s.binding, `SELECT pg_catalog.has_table_privilege(current_user,$1::pg_catalog.oid,'INSERT') AND pg_catalog.has_table_privilege(current_user,$2::pg_catalog.oid,'INSERT') AND pg_catalog.has_any_column_privilege(current_user,$2::pg_catalog.oid,'UPDATE')`, []any{s.profile.Objects["mil_recruit_origin"].OID, s.profile.Objects["mil_recruit_receipt"].OID}, &valid); err != nil {
		return err
	}
	if !valid {
		return ErrFreshCitySource
	}
	return nil
}
