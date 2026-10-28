package world

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrFreshCitySource = errors.New("world: fresh city source unavailable")
var worldSourceNames = [...]string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"}

// FreshCityParticipant binds independent expectations, not approval/provenance.
// This component supplies construction/Pin only; no live creation is wired.
// APP must hold its enrolled generation lease and external exclusions through
// commit. Constructors cannot infer those conditions from metadata or a profile.
type FreshCityParticipant struct {
	binding  *recruittx.Binding
	profile  freshsource.Profile
	sequence *citySequence
}

func NewFreshCityParticipant(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*FreshCityParticipant, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || a == nil || b == nil || ctx == nil || len(p.Objects) != len(worldSourceNames) {
		return nil, ErrFreshCitySource
	}
	for _, name := range worldSourceNames {
		if _, ok := p.Objects[name]; !ok {
			return nil, ErrFreshCitySource
		}
	}
	copyAccess := *a
	stamp, err := validateFreshSource(ctx, &copyAccess, b, p)
	if err != nil {
		return nil, err
	}
	return &FreshCityParticipant{b, p, &citySequence{binding: b, schema: p.SchemaName, stamp: stamp}}, nil
}

// Pin follows the frozen WORLD relation order; it neither allocates nor creates.
// The coordinator owns prior pins/actor/wallet order and the sole transaction end.
func (p *FreshCityParticipant) Pin(ctx context.Context, a *recruittx.Access) error {
	if p == nil || p.binding == nil || p.sequence == nil || a == nil || ctx == nil || p.sequence.retired.Load() {
		return ErrFreshCitySource
	}
	copyAccess := *a
	for _, pin := range []struct{ table, mode string }{{"map_cell", "ROW SHARE"}, {"player_city", "ROW EXCLUSIVE"}} {
		if _, err := copyAccess.Exec(ctx, p.binding, "LOCK TABLE "+pgx.Identifier{p.profile.SchemaName, pin.table}.Sanitize()+" IN "+pin.mode+" MODE"); err != nil {
			var pgerr *pgconn.PgError
			if errors.As(err, &pgerr) && (pgerr.Code == "42P01" || pgerr.Code == "3F000" || pgerr.Code == "42809" || pgerr.Code == "42501") {
				p.sequence.retired.Store(true)
			}
			return err
		}
	}
	stamp, err := validateFreshSource(ctx, &copyAccess, p.binding, p.profile)
	if err == nil && stamp != p.sequence.stamp {
		err = ErrFreshCitySource
	}
	if errors.Is(err, ErrFreshCitySource) || errors.Is(err, errCitySequence) {
		p.sequence.retired.Store(true) // later admission only, not a drain fence
	}
	return err
}

func validateFreshSource(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) (citySequenceStamp, error) {
	stamp, err := inspectCitySequence(ctx, a, b, p.SchemaName)
	if err != nil {
		return stamp, err
	}
	seq := p.Objects["player_city_id_seq"]
	if stamp.database != p.DatabaseOID || stamp.databaseName != p.DatabaseName || stamp.namespace != p.SchemaOID ||
		stamp.schemaOwner != p.SchemaOwnerOID || stamp.roleOID != p.CurrentRoleOID || stamp.sessionOID != p.SessionRoleOID ||
		stamp.role != p.CurrentRoleName || stamp.session != p.SessionRoleName || stamp.sequence != seq.OID || stamp.owner != seq.OwnerOID {
		return citySequenceStamp{}, ErrFreshCitySource
	}
	var first string
	if err = a.Scan(ctx, b, `SELECT (pg_catalog.current_schemas(true))[1]::pg_catalog.text`, nil, &first); err != nil {
		return citySequenceStamp{}, err
	}
	// Safe builtin-default deparse, without changing any caller setting.
	if first != "pg_catalog" {
		return citySequenceStamp{}, ErrFreshCitySource
	}
	objects, err := json.Marshal(p.Objects)
	if err != nil {
		return citySequenceStamp{}, err
	}
	var valid bool
	if err = a.Scan(ctx, b, freshSourceCatalog, []any{objects, p.SchemaOID, worldColumnShape, worldConstraintShape, worldIndexShape}, &valid); err != nil {
		return citySequenceStamp{}, err
	}
	if !valid {
		return citySequenceStamp{}, ErrFreshCitySource
	}
	return stamp, nil
}
