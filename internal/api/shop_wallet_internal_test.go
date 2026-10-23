package api

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

func TestSyncDomesticWalletFromShard(t *testing.T) {
	srv := NewServer(nil, nil, nil, domestic.NewHub(nil), nil)
	const cityID = 77
	const playerID = 5151
	srv.cities[cityID] = &domestic.CityState{
		ID: cityID, PlayerID: playerID,
		Wallet: domestic.Resources{Food: 1, Wood: 2, Iron: 3, Stone: 4},
	}
	after := content.ResourceWallet{Food: 10, Wood: 20, Iron: 30, Stone: 40, Gold: 99}
	srv.syncDomesticWalletFromShard(1, playerID, after)
	got := srv.cities[cityID].Wallet
	if got.Food != 10 || got.Wood != 20 || got.Iron != 30 || got.Stone != 40 {
		t.Fatalf("domestic wallet %+v", got)
	}
}
