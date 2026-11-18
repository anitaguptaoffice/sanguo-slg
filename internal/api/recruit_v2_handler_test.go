package api

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestRecruitV2HandlerDormant(t *testing.T) {
	s := NewServer(nil, nil, nil, nil, nil)
	reply := s.GatewayRouter().Dispatch(context.Background(), &commonv1.ClientPacket{Route: routeRecruitTroopV2})
	if reply.GetCode() != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || reply.GetMsg() != "unknown route" || s.PublicRoutes()[routeRecruitTroopV2] {
		t.Fatal("Recruit V2 was exposed without runtime composition", reply)
	}
}

func TestRecruitV2HandlerWithholdsUnconfirmedReceipt(t *testing.T) {
	for _, result := range []recruitAttemptResult{
		{outcome: recruitUnknown, cause: march.ErrRecruitAdmissionCount},
		{outcome: recruitNotStarted, cause: march.ErrRecruitConflict},
		{outcome: recruitKnownEnded, cause: errors.Join(march.ErrRecruitAdmissionUnit, errors.New("source failure"))},
		{outcome: recruitKnownEnded, cause: march.ErrRecruitConflict, cleanup: errors.New("cleanup failure")},
		{outcome: recruitKnownEnded, cause: march.ErrRecruitConflict, diagnostic: errors.New("ownership failure")},
	} {
		result.confirmed = march.RecruitAcceptance{QueueID: 100}
		reply, err := recruitV2Response("unknown", result)
		if err != nil || reply.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || len(reply.GetData()) != 0 {
			t.Fatal("unproven result escaped as an acceptance or business rejection", reply, err)
		}
	}
}
