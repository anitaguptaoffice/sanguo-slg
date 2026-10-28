package march

import (
	"context"
	"errors"
	"sync/atomic"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrFreshCitySource = errors.New("march: fresh city source unavailable")

// FreshCityParticipant captures local consistency, not approval or provenance.
// APP still owns its admission lease, external exclusions and transaction end.
// Copies share irreversible retirement. No Initialize or live caller is wired here.
type FreshCityParticipant struct{ state *freshMilitarySource }
type freshMilitarySource struct {
	binding *recruittx.Binding
	profile freshsource.Profile
	retired atomic.Bool
}

func NewFreshCityParticipant(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*FreshCityParticipant, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || b == nil || a == nil || len(p.Objects) != 14 {
		return nil, ErrFreshCitySource
	}
	for _, names := range [][]string{freshBaseNames[:], freshQueueNames[:], freshRetainedNames[:], {"work_queue_id_seq"}} {
		for _, name := range names {
			if _, ok := p.Objects[name]; !ok {
				return nil, ErrFreshCitySource
			}
		}
	}
	s := &freshMilitarySource{binding: b, profile: p}
	copyAccess := *a
	if err = s.validate(ctx, &copyAccess); err != nil {
		return nil, err
	}
	return &FreshCityParticipant{state: s}, nil
}

// Pin takes only the frozen MIL pins, never lifecycle or business locks.
func (p *FreshCityParticipant) Pin(ctx context.Context, a *recruittx.Access) error {
	if p == nil || p.state == nil || p.state.binding == nil || ctx == nil || a == nil || p.state.retired.Load() {
		return ErrFreshCitySource
	}
	s := p.state
	copyAccess := *a
	for _, pin := range []struct{ table, mode string }{
		{"mil_city_origin", "ROW EXCLUSIVE"}, {"city_troop", "ROW EXCLUSIVE"}, {"work_queue", "ROW EXCLUSIVE"},
		{"mil_recruit_origin", "ACCESS SHARE"}, {"mil_recruit_receipt", "ACCESS SHARE"},
	} {
		if _, err := copyAccess.Exec(ctx, s.binding, "LOCK TABLE ONLY "+pgx.Identifier{s.profile.SchemaName, pin.table}.Sanitize()+" IN "+pin.mode+" MODE"); err != nil {
			return s.failure(err)
		}
	}
	err := s.failure(s.validate(ctx, &copyAccess))
	if err == nil && s.retired.Load() {
		return ErrFreshCitySource
	}
	return err
}

func (s *freshMilitarySource) failure(err error) error {
	var e *pgconn.PgError
	if errors.Is(err, ErrFreshCitySource) || errors.Is(err, errFreshMilitaryBase) || errors.Is(err, errFreshMilitaryQueue) || errors.Is(err, errFreshMilitaryRetained) ||
		(errors.As(err, &e) && (e.Code == "42P01" || e.Code == "3F000" || e.Code == "42809" || e.Code == "42501")) {
		s.retired.Store(true)
	}
	return err
}

func (s *freshMilitarySource) validate(ctx context.Context, a *recruittx.Access) error {
	for _, check := range []func(context.Context, *recruittx.Access, *recruittx.Binding, freshsource.Profile) error{
		validateFreshMilitaryBase, validateFreshMilitaryQueue, validateFreshMilitaryRetained,
	} {
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
	if last < 1 || last > 9007199254740991 || (last == 9007199254740991 && called) {
		return ErrFreshCitySource
	}
	return nil
}

// Read-only; no nextval, setval, provisioning, retained-highwater inference or repair.
const freshMilitarySequence = `SELECT COALESCE((SELECT
 c.relnamespace OPERATOR(pg_catalog.=) $3::pg_catalog.oid AND c.relowner OPERATOR(pg_catalog.=) $2::pg_catalog.oid
 AND c.relname OPERATOR(pg_catalog.=) 'work_queue_id_seq' AND c.relkind OPERATOR(pg_catalog.=) 'S'
 AND c.relpersistence OPERATOR(pg_catalog.=) 'p' AND c.reloptions IS NULL AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
 AND q.seqtypid OPERATOR(pg_catalog.=) 'pg_catalog.int8'::pg_catalog.regtype
 AND q.seqstart OPERATOR(pg_catalog.=) 1 AND q.seqincrement OPERATOR(pg_catalog.=) 1
 AND q.seqmin OPERATOR(pg_catalog.=) 1 AND q.seqmax OPERATOR(pg_catalog.=) 9007199254740991
 AND q.seqcache OPERATOR(pg_catalog.=) 1 AND NOT q.seqcycle
 AND pg_catalog.has_sequence_privilege(current_user,c.oid,'SELECT')
 AND pg_catalog.has_sequence_privilege(current_user,c.oid,'USAGE')
 AND pg_catalog.has_sequence_privilege(current_user,c.oid,'UPDATE')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend d WHERE d.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
 AND d.objid OPERATOR(pg_catalog.=) c.oid AND d.deptype OPERATOR(pg_catalog.=) ANY(ARRAY['a','i','e']::pg_catalog."char"[]))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend d WHERE d.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
 AND d.refobjid OPERATOR(pg_catalog.=) c.oid AND d.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_attrdef'::pg_catalog.regclass)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_class r JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) r.oid
 WHERE r.relnamespace OPERATOR(pg_catalog.=) $3::pg_catalog.oid AND r.relkind OPERATOR(pg_catalog.=) ANY(ARRAY['r','p','v','m','f']::pg_catalog."char"[])
 AND NOT a.attisdropped AND a.attname OPERATOR(pg_catalog.=) ANY(ARRAY['queue_id','queue_ids']::pg_catalog.name[])
 AND NOT (a.attname OPERATOR(pg_catalog.=) 'queue_id' AND r.relname OPERATOR(pg_catalog.=) ANY(ARRAY['work_queue','mil_recruit_origin','mil_recruit_receipt']::pg_catalog.name[])))
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_sequence q ON q.seqrelid OPERATOR(pg_catalog.=) c.oid
 WHERE c.oid OPERATOR(pg_catalog.=) $1::pg_catalog.oid),false)`
