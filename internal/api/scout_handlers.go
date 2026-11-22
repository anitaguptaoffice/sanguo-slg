package api

import (
	"context"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListScoutReports(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.ListScoutReportsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	rows, err := combat.ListScoutReports(ctx, s.PlayersPool(), pc.ServerID, pc.PlayerID, int(req.GetLimit()))
	if err != nil {
		return nil, err
	}
	out := make([]*militaryv1.ScoutReportView, 0, len(rows))
	for _, r := range rows {
		out = append(out, &militaryv1.ScoutReportView{ReportId: r.ReportID, X: int32(r.X), Y: int32(r.Y),
			Tier: int32(r.Tier), TargetName: r.TargetName, Detail: string(r.Detail), CreatedAtMs: r.CreatedAt.UnixMilli()})
	}
	data, err := marshal(&militaryv1.ListScoutReportsResponse{Reports: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListBeaconWarnings(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.ListBeaconWarningsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	rows, err := s.PlayersPool().Query(ctx, `SELECT warning_id,x,y,purpose,arrive_at,beacon_level,attacker_player_id,attacker_troops,hero_id
		FROM beacon_warning WHERE server_id=$1 AND defender_player_id=$2 AND arrive_at>now() ORDER BY arrive_at`, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*militaryv1.BeaconWarningView
	for rows.Next() {
		var v militaryv1.BeaconWarningView
		var arrive time.Time
		if err := rows.Scan(&v.WarningId, &v.X, &v.Y, &v.Purpose, &arrive, &v.BeaconLevel,
			&v.AttackerPlayerId, &v.AttackerTroops, &v.HeroId); err != nil {
			return nil, err
		}
		v.ArriveAtMs = arrive.UnixMilli()
		out = append(out, &v)
	}
	data, err := marshal(&militaryv1.ListBeaconWarningsResponse{Warnings: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) recordBeaconWarning(ctx context.Context, pc PlayerContext, toX, toY, purpose int32, heroID int64, arriveAt time.Time, troops []march.TroopStack) {
	if purpose != 1 && purpose != 3 && purpose != 4 || s.PlayersPool() == nil {
		return
	}
	var defender, cityID int64
	if err := s.PlayersPool().QueryRow(ctx, `SELECT player_id,city_id FROM player_city
		WHERE server_id=$1 AND x=$2 AND y=$3`, pc.ServerID, toX, toY).Scan(&defender, &cityID); err != nil {
		return
	}
	if defender == pc.PlayerID || defender == 0 {
		return
	}
	var beacon int32
	if err := s.PlayersPool().QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=19`, pc.ServerID, cityID).Scan(&beacon); err != nil || beacon < 1 {
		return
	}
	total := 0
	for _, t := range troops {
		total += int(t.Count)
	}
	arrive := arriveAt
	_, _ = s.PlayersPool().Exec(ctx, `INSERT INTO beacon_warning(server_id,defender_player_id,defender_city_id,
		attacker_player_id,x,y,purpose,arrive_at,beacon_level,attacker_troops,hero_id)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, pc.ServerID, defender, cityID, pc.PlayerID, toX, toY,
		purpose, arrive, beacon, total, heroID)
}
