package api

import (
	"context"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const routeRecruitTroopV2 = "military.v1.RecruitTroopV2"

// recruitV2Handler requires the gateway's live session validation before
// dispatch. Only a future fenced composition can register it.
func (s *Server) recruitV2Handler(g *recruitGeneration) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		trace := pkt.GetTraceId()
		pc, denied := s.playerCtx(ctx, pkt)
		if denied != nil {
			return denied, nil
		}
		if pc.AccountID <= 0 || pc.PlayerID <= 0 || pc.ServerID <= 0 {
			return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "invalid recruit actor"), nil
		}
		var req militaryv1.RecruitTroopV2Request
		var command march.RecruitCommandID
		if err := unmarshal(pkt.GetPayload(), &req); err != nil || len(req.GetCommandId()) != len(command) {
			return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid recruit request"), nil
		}
		copy(command[:], req.GetCommandId())
		if command == (march.RecruitCommandID{}) {
			return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid recruit command ID"), nil
		}
		scope := march.RecruitScope{ServerID: pc.ServerID, PlayerID: pc.PlayerID, CommandID: command}
		intent := march.RecruitIntent{
			Version: req.GetIntentVersion(), CityID: req.GetCityId(), UnitCfgID: req.GetUnitCfgId(), Count: req.GetCount(),
		}
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		return recruitV2Response(trace, g.admit(ctx, pc.AccountID, scope, intent))
	}
}

func recruitV2Response(trace string, result recruitAttemptResult) (*commonv1.ServerPacket, error) {
	if result.outcome == recruitConfirmed {
		a := result.confirmed
		data, err := marshal(&militaryv1.RecruitTroopV2Response{Acceptance: &militaryv1.RecruitAcceptance{
			QueueId: a.QueueID, CityId: a.CityID, UnitCfgId: a.UnitCfgID, Count: a.Count,
			FoodPaid: a.Cost.Food, WoodPaid: a.Cost.Wood, IronPaid: a.Cost.Iron, StonePaid: a.Cost.Stone,
			DurationSec: a.DurationSeconds, InitialStatus: int32(a.InitialStatus),
			AcceptedAtMs: a.AcceptedAt.UnixMilli(), InitialStartAtMs: a.InitialStartAt.UnixMilli(),
			InitialFinishAtMs: a.InitialFinishAt.UnixMilli(), CatalogVersion: []byte(a.CatalogVersion), RuleDigest: a.RuleDigest[:],
		}})
		if err != nil {
			return nil, err
		}
		return okResp(trace, data), nil
	}
	if result.outcome == recruitKnownEnded && result.cleanup == nil && result.diagnostic == nil {
		switch result.cause {
		case march.ErrRecruitConflict:
			return errResp(trace, commonv1.ErrorCode_MILITARY_RECRUIT_INTENT_CONFLICT, "recruit intent conflict"), nil
		case march.ErrRecruitUnsupportedVersion:
			return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "unsupported recruit intent version"), nil
		case march.ErrRecruitAdmissionCount:
			return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT, "recruit count cannot be accepted"), nil
		case march.ErrRecruitAdmissionUnit:
			return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_UNIT, "unknown recruit unit"), nil
		case domestic.ErrRecruitWalletFunds:
			return errResp(trace, commonv1.ErrorCode_MILITARY_INSUFFICIENT_RESOURCE, "insufficient resources"), nil
		}
	}
	return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "recruit outcome unavailable"), nil
}
