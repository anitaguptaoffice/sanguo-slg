package api

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

type durableMarchCreator struct {
	server *Server
	source *recruitGeneration
	store  *march.MarchStore
}

type durableMarchCommit struct {
	identity march.MarchIdentity
	ready    [4]int32
	input    march.MarchCreate
}

// preparedMarchHandler binds the private, default-off StartMarch entry.
// Runtime may mount it only after the reviewed durable lifecycle is in place.
func (s *Server) preparedMarchHandler(ctx context.Context) (gateway.RouteHandler, error) {
	if !s.MarchRestoreReady() || s.preparedRecruit == nil || s.preparedRecruit.s == nil || s.military == nil ||
		s.domestic == nil || s.heroSvc == nil {
		return nil, errRecruitGeneration
	}
	g := s.preparedRecruit
	store, err := march.NewMarchStore(ctx, g.s.binding, g.s.profile)
	if err != nil {
		return nil, err
	}
	writer := durableMarchCreator{server: s, source: g, store: store}
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		return s.startMarch(ctx, pkt, true, writer.write)
	}, nil
}

func (c durableMarchCreator) write(ctx context.Context, pc PlayerContext, req *militaryv1.StartMarchRequest, coord cityCoord, troops []march.TroopStack, trace string) (*commonv1.ServerPacket, error) {
	s := c.server
	unavailable := func() (*commonv1.ServerPacket, error) {
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "prepared march unavailable"), nil
	}
	if pc.AccountID <= 0 {
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "invalid march actor"), nil
	}
	if coord.x < 0 || coord.y < 0 || coord.x >= world.MapSize || coord.y >= world.MapSize ||
		req.GetToX() < 0 || req.GetToY() < 0 || req.GetToX() >= world.MapSize || req.GetToY() >= world.MapSize ||
		coord == (cityCoord{int(req.GetToX()), int(req.GetToY())}) {
		return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_MARCH, "invalid march destination or origin"), nil
	}
	if !s.beginMarchStart(pc, req.GetHeroId()) {
		return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_MARCH, "hero march request in progress"), nil
	}
	defer s.endMarchStart(pc, req.GetHeroId())
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	canonical := slices.Clone(troops)
	slices.SortFunc(canonical, func(a, b march.TroopStack) int { return cmp.Compare(a.UnitCfgID, b.UnitCfgID) })
	in := march.MarchCreate{ServerID: pc.ServerID, PlayerID: pc.PlayerID, OwnerPlayerID: pc.PlayerID,
		OriginCityID: req.GetCityId(), ArmyStatus: 2, FromX: int32(coord.x), FromY: int32(coord.y),
		ToX: req.GetToX(), ToY: req.GetToY(), Purpose: int16(req.GetPurpose()), HeroIDs: []int64{req.GetHeroId()}, Troops: canonical}
	if _, err := c.transaction(ctx, pc, in, false); err != nil {
		if errors.Is(err, march.ErrInsufficientTroops) && !errors.Is(err, recruittx.ErrOutcomeUnknown) {
			return s.mapMarchCreateErr(trace, err), nil
		}
		s.log.ErrorContext(ctx, "prepared march preflight failed", "error", err)
		return unavailable()
	}
	if _, err := s.domestic.SettleCity(ctx, in.OriginCityID); err != nil {
		s.log.ErrorContext(ctx, "prepared march settlement failed", "error", err)
		return unavailable()
	}
	if err := s.claimMarchHero(ctx, pc, req.GetHeroId()); err != nil {
		reply := s.mapMarchHeroErr(trace, err)
		if reply.GetCode() == int32(commonv1.ErrorCode_COMMON_INTERNAL) {
			s.log.ErrorContext(ctx, "prepared march HERO claim failed", "error", err)
			return unavailable()
		}
		return reply, nil
	}
	result, err := c.transaction(ctx, pc, in, true)
	if err != nil {
		if !errors.Is(err, recruittx.ErrOutcomeUnknown) {
			cleanup, stop := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			defer stop()
			actor := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
			if release := s.heroSvc.ReleaseMarchOrphan(cleanup, c.source.s.profile.SchemaName, actor, req.GetHeroId()); release != nil {
				s.log.ErrorContext(ctx, "prepared march orphan release failed", "error", release)
				return unavailable()
			}
			if errors.Is(err, march.ErrInsufficientTroops) {
				return s.mapMarchCreateErr(trace, err), nil
			}
		}
		s.log.ErrorContext(ctx, "prepared march creation failed", "error", err)
		return unavailable()
	}
	id := result.identity.MarchID
	s.recordPlayerMarch(pc, in.OriginCityID, id, req.GetHeroId(), canonical)
	order, err := s.military.PublishCommittedMarch(result.input, result.identity)
	if err != nil {
		s.forgetPreparedMarch(pc.PlayerID, id)
		_ = c.source.close()
		s.log.ErrorContext(ctx, "confirmed march requires startup recovery", "march_id", id, "error", err)
		return unavailable()
	}
	ready := make(map[int32]int32, len(result.ready))
	for i, count := range result.ready {
		ready[int32(i+1)] = count
	}
	data, err := marshal(&militaryv1.StartMarchResponse{
		March: marchSummaryProto(in.OriginCityID, order, canonical), CityTroops: troopStacksProto(ready, troops),
	})
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

// transaction is used first as a no-write eligibility check, then with
// commit=true after the existing HERO claim completes. Both passes lock the
// authoritative owner and compare the cached origin to the locked WORLD row.
func (c durableMarchCreator) transaction(ctx context.Context, pc PlayerContext, in march.MarchCreate, commit bool) (out durableMarchCommit, err error) {
	g := c.source.s
	g.mu.Lock()
	if g.closed || g.bundle == nil || g.profile.ServerID != pc.ServerID || pc.AccountID <= 0 ||
		in.ServerID != pc.ServerID || in.PlayerID != pc.PlayerID || in.OwnerPlayerID != pc.PlayerID {
		g.mu.Unlock()
		return out, errRecruitGeneration
	}
	bundle := *g.bundle
	lease, err := g.admission.acquire(ctx)
	g.mu.Unlock()
	if err != nil {
		return out, err
	}

	var owner *recruittx.Owner
	committed := false
	committing := false
	defer func() {
		fault := recover()
		if committed {
			_ = lease.ended()
			return
		}
		out = durableMarchCommit{}
		unknown := owner == nil || errors.Is(err, recruittx.ErrOutcomeUnknown) || committing && fault != nil
		var cleanupFault any
		if owner != nil {
			var rollbackErr error
			rollbackErr, cleanupFault = rollbackRecruitValidation(owner)
			unknown = unknown || rollbackErr != nil
			err = errors.Join(err, rollbackErr)
		}
		if unknown {
			err = errors.Join(err, recruittx.ErrOutcomeUnknown, lease.unknown(), c.source.close())
		} else {
			err = errors.Join(err, lease.ended())
		}
		panicRecruitAttempt(fault, cleanupFault)
	}()
	if owner, err = g.binding.Begin(ctx); err != nil {
		return out, err
	}
	a := owner.Access()
	for _, pin := range []func(context.Context, *recruittx.Access) error{
		bundle.actor.Pin, bundle.wallet.Pin, bundle.city.Pin, bundle.military.Pin,
	} {
		if err := pin(ctx, a); err != nil {
			return out, err
		}
	}
	if err := bundle.actor.Lock(ctx, a, pc.AccountID, pc.PlayerID); err != nil {
		return out, err
	}
	if _, err := bundle.wallet.Lock(ctx, a, pc.PlayerID); err != nil {
		return out, err
	}
	origin, err := bundle.city.LockReturnOrigin(ctx, a, pc.PlayerID, in.OriginCityID)
	if err != nil {
		return out, err
	}
	if origin.ServerID != in.ServerID || origin.PlayerID != in.PlayerID || origin.CityID != in.OriginCityID ||
		origin.X != in.FromX || origin.Y != in.FromY {
		return out, world.ErrRecruitCity
	}
	if !commit {
		ready, err := bundle.military.ReadReadyGarrison(ctx, a, pc.ServerID, pc.PlayerID, in.OriginCityID)
		if err != nil {
			return out, err
		}
		if _, err := bundle.military.ReadCurrentRecruitQueue(ctx, a, pc.ServerID, pc.PlayerID, in.OriginCityID); err != nil {
			return out, err
		}
		for _, stack := range in.Troops {
			if stack.UnitCfgID < 1 || stack.UnitCfgID > int32(len(ready)) || stack.Count <= 0 {
				return out, march.ErrInvalidMarch
			}
			if stack.Count > ready[stack.UnitCfgID-1] {
				return out, march.ErrInsufficientTroops
			}
		}
		return out, nil
	}
	if err := a.Scan(ctx, g.binding, "SELECT pg_catalog.clock_timestamp()", nil, &in.DepartAt); err != nil {
		return out, err
	}
	in.DepartAt = in.DepartAt.UTC()
	planned, err := march.BeginMarch(march.DefaultUnitCatalog(), in.DepartAt, march.StartMarchRequest{
		FromX: int(in.FromX), FromY: int(in.FromY), ToX: int(in.ToX), ToY: int(in.ToY), Troops: in.Troops,
	})
	if err != nil {
		return out, err
	}
	in.ArriveAt = planned.ArriveAt
	if out.ready, err = bundle.military.DebitMarchTroops(ctx, a, pc.ServerID, pc.PlayerID, in.OriginCityID, in.Troops); err != nil {
		return out, err
	}
	if out.identity, err = c.store.Create(ctx, a, in); err != nil {
		return out, err
	}
	committing = true
	if err = owner.Commit(ctx); err != nil {
		return out, err
	}
	committed = true
	out.input = in
	return out, nil
}
