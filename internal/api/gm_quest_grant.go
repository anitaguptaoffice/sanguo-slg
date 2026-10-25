package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

// GmGrantRewardWithQuestHooks grants rewards and applies collect_resource daily quest hooks from wallet deltas.
func (s *Server) GmGrantRewardWithQuestHooks(ctx context.Context, audit GmAudit, serverID int32, playerID int64, pkg content.RewardPackage, idempotencyKey string) (GmOpResult, content.GrantResult, error) {
	before, err := s.readPlayerResourceWallet(ctx, serverID, playerID)
	if err != nil {
		return GmOpResult{}, content.GrantResult{}, err
	}
	res, grant, err := s.Gm().GrantReward(ctx, "", audit, serverID, playerID, pkg, idempotencyKey)
	if err != nil {
		return res, grant, err
	}
	after, err := s.readPlayerResourceWallet(ctx, serverID, playerID)
	if err != nil {
		return res, grant, err
	}
	s.refreshDomesticWalletAfterCommit(ctx, serverID, playerID)
	s.questAfterResourceGain(ctx, serverID, playerID, walletToDomestic(before), walletToDomestic(after))
	return res, grant, nil
}

func (s *Server) readPlayerResourceWallet(ctx context.Context, serverID int32, playerID int64) (content.ResourceWallet, error) {
	if s == nil || s.players == nil || s.players.Pool == nil {
		return content.ResourceWallet{}, nil
	}
	pgWallet, ok := s.newShopWalletStore().(*pgShopWallet)
	if !ok || pgWallet == nil {
		return content.ResourceWallet{}, nil
	}
	return pgWallet.readWallet(ctx, content.PlayerRef{ServerID: serverID, PlayerID: playerID})
}

func walletToDomestic(w content.ResourceWallet) domestic.Resources {
	return domestic.Resources{Food: w.Food, Wood: w.Wood, Iron: w.Iron, Stone: w.Stone}
}
