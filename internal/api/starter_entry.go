package api

import (
	"context"

	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) wrapStarterEntry(inner gateway.RouteHandler) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		resp, err := inner(ctx, pkt)
		if err == nil && resp != nil && resp.GetCode() == 0 {
			var entry accountv1.EnterGameServerResponse
			if unmarshal(resp.GetData(), &entry) == nil && entry.GetPlayer() != nil {
				if err := s.refreshTutorialProfile(ctx, entry.Player); err != nil {
					return questErr(pkt.GetTraceId(), err), nil
				}
				resp.Data, err = marshal(&entry)
				if err != nil {
					return nil, err
				}
				// Use this authenticated response, not a session re-bound by a later entry.
				resp.Msg = s.starterScrollNotice(ctx, PlayerContext{
					ServerID: entry.GetServerId(), PlayerID: entry.GetPlayer().GetPlayerId(),
				})
			}
		}
		return resp, err
	}
}
