package march

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var ErrReturnUnavailable = errors.New("march: return transition unavailable")

// These copied values are not authorization or proof of same-transaction origin.
type ReturnCandidate struct {
	ServerID                        int32
	PlayerID, CityID, MarchID, ArmyID int64
}
type ReturnOrigin struct {
	ServerID         int32
	PlayerID, CityID int64
	X, Y             int32
}
type returnPhase uint8

const (
	returnReturning returnPhase = iota + 1
	returnCredited
	returnAnnihilated
)

type returnLockedSnapshot struct {
	pending                     recruitPendingSnapshot
	phase                       returnPhase
	armyID, owner               int64
	cityID                      *int64
	status, armyStatus, purpose  int16
	fromX, fromY, toX, toY, x, y int32
	depart, arrive              time.Time
	returnAt                    *time.Time
	heroes                      []int64
	units, counts               []int32
}

func validReturnScope(server int32, c ReturnCandidate, o ReturnOrigin) bool {
	for _, id := range []int64{c.PlayerID, c.CityID, c.MarchID, c.ArmyID} {
		if id <= 0 || id > marchIDCeiling {
			return false
		}
	}
	// The reviewed WORLD map includes zero and excludes 500 on both axes.
	return server > 0 && c.ServerID == server && o.ServerID == server &&
		o.PlayerID == c.PlayerID && o.CityID == c.CityID &&
		o.X >= 0 && o.X < 500 && o.Y >= 0 && o.Y < 500
}

// returnLocked requires Pin on this live Access and the ordered outer actor,
// wallet and WORLD locks. Only the fixed caller graph proves those obligations.
// It owns snapshots, not completion/retry authority; caller must rollback errors.
func (p *ReturnParticipant) returnLocked(ctx context.Context, a *recruittx.Access, c ReturnCandidate, origin ReturnOrigin) (out returnLockedSnapshot, err error) {
	defer func() {
		if err != nil {
			out = returnLockedSnapshot{}
			err = errors.Join(ErrReturnUnavailable, err)
		}
	}()
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() {
		return out, ErrReturnSource
	}
	s, access := p.source, *a
	if !validReturnScope(s.profile.ServerID, c, origin) {
		return out, ErrReturnUnavailable
	}
	if err = p.validate(ctx, &access); err != nil {
		return out, err
	}
	scope := recruitScope{c.ServerID, c.PlayerID, c.CityID}
	if out.pending, err = readRecruitPending(ctx, &access, s, scope); err != nil {
		return out, returnSourceFailure(s, err)
	}
	// Stock legality only: no pending decoding, evidence, admission or capacity.
	if _, err = validateRecruitPending(scope, out.pending.stock, nil, p.catalog); err != nil {
		return out, err
	}
	read := func(query string, args []any, dest ...any) error {
		return returnSourceFailure(s, access.Scan(ctx, s.binding, query, args, dest...))
	}
	if err = read(`SELECT army_id,origin_city_id,status,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,return_finish_at FROM `+s.table("march_order")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{c.ServerID, c.MarchID}, &out.armyID, &out.cityID, &out.status, &out.fromX, &out.fromY, &out.toX, &out.toY, &out.purpose, &out.depart, &out.arrive, &out.returnAt); err != nil {
		return out, err
	}
	if out.armyID != c.ArmyID {
		return out, ErrReturnUnavailable
	}
	if err = read(`SELECT owner_player_id,status,x,y,hero_ids FROM `+s.table("field_army")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`, []any{c.ServerID, c.ArmyID}, &out.owner, &out.armyStatus, &out.x, &out.y, &out.heroes); err != nil {
		return out, err
	}
	if err = read(`SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count FROM `+s.table("army_troop")+` WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`, []any{c.ServerID, c.ArmyID}, &out.units, &out.counts); err != nil {
		return out, err
	}
	out.depart, out.arrive = out.depart.UTC(), out.arrive.UTC()
	if out.returnAt != nil {
		at := out.returnAt.UTC()
		out.returnAt = &at
	}
	out.phase = classifyReturnGraph(c, origin, out)
	if out.phase == 0 {
		return out, ErrReturnUnavailable
	}
	if s.retired.Load() {
		return out, ErrReturnSource
	}
	return out, nil
}

func classifyReturnGraph(c ReturnCandidate, origin ReturnOrigin, s returnLockedSnapshot) returnPhase {
	if s.armyID != c.ArmyID || s.owner != c.PlayerID || s.cityID == nil || *s.cityID != c.CityID ||
		s.fromX != origin.X || s.fromY != origin.Y || s.toX < 0 || s.toX >= 500 || s.toY < 0 || s.toY >= 500 ||
		s.purpose < 1 || s.purpose > 3 || !validMarchTime(s.depart) || !validMarchTime(s.arrive) ||
		!s.depart.Before(s.arrive) || len(s.heroes) == 0 || len(s.units) != len(s.counts) {
		return 0
	}
	seen := make(map[int64]bool, len(s.heroes))
	for _, id := range s.heroes {
		if id <= 0 || seen[id] {
			return 0
		}
		seen[id] = true
	}
	var previous int32
	for i, unit := range s.units {
		if unit <= previous || unit > 4 || s.counts[i] <= 0 {
			return 0
		}
		previous = unit
	}
	atDestination := s.x == s.toX && s.y == s.toY
	if s.status == 4 && s.armyStatus == 1 && atDestination && len(s.units) == 0 && s.returnAt == nil {
		return returnAnnihilated
	}
	if len(s.units) == 0 || s.returnAt == nil || !validMarchTime(*s.returnAt) || !s.returnAt.After(s.arrive) {
		return 0
	}
	if s.status == 3 && s.armyStatus == 2 && atDestination {
		return returnReturning
	}
	if s.status == 4 && s.armyStatus == 1 && s.x == origin.X && s.y == origin.Y {
		return returnCredited
	}
	return 0
}
