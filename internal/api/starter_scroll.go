package api

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

const starterScrollPending = "初始招募书暂未到账，请整理背包后刷新重试"

// starterScrollNotice retries the fixed v1 benefit, not a client-supplied reward.
// An empty notice is NOT proof of delivery; only the authoritative bag is.
// Release requires the content item-only wallet-clock fix and recruit safety gates.
func (s *Server) starterScrollNotice(ctx context.Context, pc PlayerContext) string {
	if s.contentSvc == nil || s.players == nil || s.players.Pool == nil || pc.ServerID <= 0 || pc.PlayerID <= 0 {
		return "" // Unwired/in-memory servers do not deliver this durable benefit.
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var eligible bool
	// Both predicates use one statement snapshot, including every hero status.
	// Later concurrent hero/book acquisition is permitted by the contract.
	// Bootstrap writes player before wallet: never let Grant create a zero wallet
	// in that gap and win against the initial-funds INSERT ON CONFLICT DO NOTHING.
	err := s.players.Pool.QueryRow(ctx, `SELECT
		NOT EXISTS (SELECT 1 FROM player_hero WHERE server_id=$1 AND player_id=$2)
		AND NOT EXISTS (SELECT 1 FROM player_item WHERE server_id=$1 AND player_id=$2
			AND item_cfg_id=2004 AND quantity>0)
		FROM player p JOIN player_wallet w USING (server_id,player_id)
		WHERE p.server_id=$1 AND p.player_id=$2`, pc.ServerID, pc.PlayerID).Scan(&eligible)
	if err == nil && eligible {
		_, err = s.contentSvc.GrantContext(ctx, content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
			content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}},
			fmt.Sprintf("onboarding:starter-scroll:v1:%d", pc.PlayerID))
	}
	if err == nil {
		return ""
	}
	log := s.log
	if log == nil {
		log = slog.Default()
	}
	log.Warn("starter scroll deferred", "server_id", pc.ServerID, "player_id", pc.PlayerID, "error", err)
	return starterScrollPending // Never expose SQL/receipt errors or claim success.
}
