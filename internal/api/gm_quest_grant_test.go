package api

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestWalletToDomesticMapsFields(t *testing.T) {
	dom := walletToDomestic(content.ResourceWallet{Food: 1, Wood: 2, Iron: 3, Stone: 4})
	if dom.Food != 1 || dom.Wood != 2 || dom.Iron != 3 || dom.Stone != 4 {
		t.Fatalf("wallet map: %+v", dom)
	}
}
