package march

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

var ErrReturnSource = errors.New("march: return source unavailable")

// ReturnParticipant captures expectations, not enrollment or authority to write.
// Copies and future pending readers share one source and irreversible retirement.
type ReturnParticipant struct {
	source  *freshMilitarySource
	catalog *RecruitCatalog
}

func NewReturnParticipant(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile, catalog *RecruitCatalog) (*ReturnParticipant, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || b == nil || a == nil || catalog == nil || len(p.Objects) != 23 {
		return nil, errors.Join(ErrReturnSource, err)
	}
	seen := make(map[uint32]bool, 23)
	for _, names := range [][]string{freshBaseNames[:], freshQueueNames[:], freshRetainedNames[:], {"work_queue_id_seq"}, returnNames[:]} {
		for _, name := range names {
			v, ok := p.Objects[name]
			if !ok || seen[v.OID] {
				return nil, ErrReturnSource
			}
			seen[v.OID] = true
		}
	}
	records := make([]RecruitManifest, 0, len(catalog.manifests))
	for version, rules := range catalog.manifests {
		records = append(records, RecruitManifest{Version: version, Rules: rules})
	}
	snapshot, err := NewRecruitCatalog(records, catalog.current)
	if err != nil {
		return nil, errors.Join(ErrReturnSource, err)
	}
	participant := &ReturnParticipant{source: &freshMilitarySource{binding: b, profile: p}, catalog: snapshot}
	access := *a
	if err := participant.validate(ctx, &access); err != nil {
		return nil, err
	}
	return participant, nil
}

// Pin takes only the eight frozen relation pins; the caller retains and ends them.
func (p *ReturnParticipant) Pin(ctx context.Context, a *recruittx.Access) error {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() {
		return ErrReturnSource
	}
	s := p.source
	access := *a
	for _, name := range []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt", "march_order", "field_army", "army_troop"} {
		if s.retired.Load() {
			return ErrReturnSource
		}
		if _, err := access.Exec(ctx, s.binding, "LOCK TABLE ONLY "+pgx.Identifier{s.profile.SchemaName, name}.Sanitize()+" IN ROW EXCLUSIVE MODE"); err != nil {
			return returnSourceFailure(s, err)
		}
	}
	return p.validate(ctx, &access)
}

func (p *ReturnParticipant) validate(ctx context.Context, a *recruittx.Access) error {
	// Recruit validation projects the common fourteen, accepting exhausted history.
	err := validateRecruitSource(ctx, a, p.source)
	if err == nil {
		err = validateReturnCatalog(ctx, a, p.source.binding, p.source.profile)
	}
	return returnSourceFailure(p.source, err)
}

func returnSourceFailure(s *freshMilitarySource, err error) error {
	_ = s.failure(err)
	if errors.Is(err, errReturnCatalog) {
		s.retired.Store(true)
	}
	if s.retired.Load() {
		return errors.Join(ErrReturnSource, err)
	}
	return err
}
