package march

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

var (
	ErrMarchStore    = errors.New("march: invalid durable march input")
	ErrMarchSequence = errors.New("march: march sequence audit failed")
)

const marchIDCeiling int64 = 9007199254740991

// MarchCreate is the validated input for one durable march; this writer allocates both IDs.
type MarchCreate struct {
	ServerID      int32
	PlayerID      int64
	OriginCityID  int64
	OwnerPlayerID int64
	ArmyStatus    int16
	FromX, FromY  int32
	ToX, ToY      int32
	HeroIDs       []int64
	Purpose       int16
	DepartAt      time.Time
	ArriveAt      time.Time
	Troops        []TroopStack
}

type MarchIdentity struct{ MarchID, ArmyID int64 }

// MarchStore writes one field_army, one march_order and its army_troop stacks in the
// caller's transaction; it never begins, ends or touches city_troop, heroes, wallet or Hub.
type MarchStore struct {
	binding *recruittx.Binding
	profile freshsource.Profile
}

func NewMarchStore(ctx context.Context, b *recruittx.Binding, p freshsource.Profile) (*MarchStore, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return nil, ErrMarchStore
	}
	return &MarchStore{binding: b, profile: p}, nil
}

func (s *MarchStore) Create(ctx context.Context, a *recruittx.Access, in MarchCreate) (MarchIdentity, error) {
	if s == nil || s.binding == nil || ctx == nil || a == nil {
		return MarchIdentity{}, ErrMarchStore
	}
	if err := a.CheckSameTransaction(ctx, s.binding, a); err != nil {
		return MarchIdentity{}, errors.Join(ErrMarchStore, err)
	}
	if err := validateMarchCreate(s.profile.ServerID, &in); err != nil {
		return MarchIdentity{}, err
	}
	if err := s.audit(ctx, a); err != nil {
		return MarchIdentity{}, err
	}
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	exec1 := func(query string, args ...any) error {
		tag, err := a.Exec(ctx, s.binding, query, args...)
		if err != nil {
			return errors.Join(ErrMarchStore, err)
		}
		if tag.RowsAffected() != 1 {
			_, _ = a.Exec(context.WithoutCancel(ctx), s.binding, "SELECT 1/0")
			return errors.Join(ErrMarchStore, errors.New("march: insert affected an unexpected row count"))
		}
		return nil
	}
	armyID, err := s.next(ctx, a, "field_army_army_id_seq")
	if err != nil {
		return MarchIdentity{}, err
	}
	marchID, err := s.next(ctx, a, "march_order_march_id_seq")
	if err != nil {
		return MarchIdentity{}, err
	}
	if err = exec1(`INSERT INTO `+table("field_army")+`(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES($1,$2,$3,$4,$5,$6,$7)`,
		in.ServerID, armyID, in.OwnerPlayerID, in.ArmyStatus, in.FromX, in.FromY, in.HeroIDs); err != nil {
		return MarchIdentity{}, err
	}
	if err = exec1(`INSERT INTO `+table("march_order")+`(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,'[]',$11)`,
		in.ServerID, marchID, armyID, in.FromX, in.FromY, in.ToX, in.ToY, in.Purpose, in.DepartAt, in.ArriveAt, in.OriginCityID); err != nil {
		return MarchIdentity{}, err
	}
	for _, st := range in.Troops {
		if err = exec1(`INSERT INTO `+table("army_troop")+`(server_id,army_id,unit_cfg_id,count) VALUES($1,$2,$3,$4)`,
			in.ServerID, armyID, st.UnitCfgID, st.Count); err != nil {
			return MarchIdentity{}, err
		}
	}
	return MarchIdentity{MarchID: marchID, ArmyID: armyID}, nil
}

func validateMarchCreate(serverID int32, in *MarchCreate) error {
	if in == nil || in.ServerID != serverID || in.ServerID <= 0 || in.PlayerID <= 0 ||
		in.OwnerPlayerID != in.PlayerID || in.ArmyStatus != 2 || in.OriginCityID <= 0 ||
		in.Purpose < 1 || in.Purpose > 3 || !validMarchTime(in.DepartAt) || !validMarchTime(in.ArriveAt) ||
		!in.DepartAt.Before(in.ArriveAt) || len(in.Troops) == 0 || len(in.HeroIDs) == 0 {
		return ErrMarchStore
	}
	units := make(map[int32]bool, len(in.Troops))
	for _, st := range in.Troops {
		if st.UnitCfgID <= 0 || st.Count <= 0 || units[st.UnitCfgID] {
			return ErrMarchStore
		}
		units[st.UnitCfgID] = true
	}
	heroes := make(map[int64]bool, len(in.HeroIDs))
	for _, id := range in.HeroIDs {
		if id <= 0 || heroes[id] {
			return ErrMarchStore
		}
		heroes[id] = true
	}
	return nil
}

func validMarchTime(t time.Time) bool { return !t.IsZero() && t.Year() >= 1 && t.Year() <= 9999 }

func marchSequenceOK(last int64, called bool, persisted int64) bool {
	return last >= 1 && last <= marchIDCeiling && (called && persisted <= last || !called && persisted < last)
}

func (s *MarchStore) audit(ctx context.Context, a *recruittx.Access) error {
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	for _, seq := range []struct{ name, table, column string }{
		{"march_order_march_id_seq", "march_order", "march_id"},
		{"field_army_army_id_seq", "field_army", "army_id"},
		{"battle_report_report_id_seq", "battle_report", "report_id"},
	} {
		var last, persisted int64
		var called bool
		query := `SELECT last_value,is_called,COALESCE((SELECT pg_catalog.max(` + seq.column + `) FROM ` + table(seq.table) + `),0) FROM ` + table(seq.name)
		if err := a.Scan(ctx, s.binding, query, nil, &last, &called, &persisted); err != nil {
			return errors.Join(ErrMarchSequence, err)
		}
		if !marchSequenceOK(last, called, persisted) {
			return ErrMarchSequence
		}
	}
	return nil
}

func (s *MarchStore) next(ctx context.Context, a *recruittx.Access, sequence string) (int64, error) {
	var id int64
	name := pgx.Identifier{s.profile.SchemaName, sequence}.Sanitize()
	if err := a.Scan(ctx, s.binding, `SELECT pg_catalog.nextval($1::pg_catalog.regclass)`, []any{name}, &id); err != nil {
		return 0, errors.Join(ErrMarchSequence, err)
	}
	if id < 1 || id > marchIDCeiling {
		return 0, ErrMarchSequence
	}
	return id, nil
}
