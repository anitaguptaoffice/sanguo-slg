package shop

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// ResourceWalletStore debits player_wallet (or test doubles). Production wiring lives in internal/api.
type ResourceWalletStore interface {
	Spend(ctx context.Context, player content.PlayerRef, cost content.ResourceWallet) (content.ResourceWallet, error)
}
