package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// devQuestCatalog matches spec/data/source/quests.yml (QUEST-001 tutorial chain).
func devQuestCatalog() *quest.MemCatalog {
	return quest.NewMemCatalog([]quest.QuestCfg{
		{
			QuestCfgID:  1001,
			Code:        "tutorial_build_hall",
			ChainID:     100,
			SortInChain: 1,
			UnlockLevel: 1,
			Objectives:  []quest.Objective{{Type: "build_level", BuildingCfgID: 1, Level: 2}},
			Rewards: quest.RewardBundle{
				Resources: map[string]int64{"food": 500},
				Items:     []quest.RewardItem{{ItemCfgID: 2001, Quantity: 1}},
			},
		},
		{
			QuestCfgID:     1002,
			Code:           "tutorial_recruit",
			ChainID:        100,
			PrevQuestCfgID: 1001,
			SortInChain:    2,
			UnlockLevel:    1,
			Objectives:     []quest.Objective{{Type: "recruit_hero", Count: 1}},
			Rewards: quest.RewardBundle{
				Items: []quest.RewardItem{{ItemCfgID: 2004, Quantity: 1}},
			},
		},
	})
}

func questChainIDsFromCatalog(cat quest.Catalog) []int32 {
	seen := make(map[int32]struct{})
	var out []int32
	for _, q := range cat.All() {
		if q.ChainID == 0 {
			continue
		}
		if _, ok := seen[q.ChainID]; ok {
			continue
		}
		seen[q.ChainID] = struct{}{}
		out = append(out, q.ChainID)
	}
	return out
}

// devShopCatalog matches spec/data/source/shop.yml (SHOP-001 smoke offer).
func devShopCatalog() shop.Catalog {
	daily := int32(3)
	return shop.Catalog{Version: 1, Offers: []shop.CatalogEntry{{
		OfferID: 1001, ShelfID: 1, ShelfName: "每日特惠", ItemCfgID: 2001, QuantityPerPurchase: 1,
		Price: content.RewardPackage{Resources: map[string]int64{"silver": 10}}, DailyLimit: &daily,
	}}}
}
