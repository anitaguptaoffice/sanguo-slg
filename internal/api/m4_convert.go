package api

import (
	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

func questProgressToProto(q quest.PlayerQuestProgress) *questv1.PlayerQuestProgress {
	return &questv1.PlayerQuestProgress{
		QuestCfgId:      q.QuestCfgID,
		QuestCode:       q.QuestCode,
		ChainId:         q.ChainID,
		ChainOrder:      q.ChainOrder,
		PrevQuestCfgId:  q.PrevQuestCfgID,
		NextQuestCfgId:  q.NextQuestCfgID,
		State:           questv1.PlayerQuestState(q.State),
		ProgressCurrent: q.ProgressCurrent,
		ProgressTarget:  q.ProgressTarget,
		AcceptedAtMs:    q.AcceptedAtMs,
		UpdatedAtMs:     q.UpdatedAtMs,
		RewardPreview:   rewardBundleToProto(q.RewardPreview),
	}
}

func questChainToProto(c quest.QuestChainStatus) *questv1.QuestChainStatus {
	return &questv1.QuestChainStatus{
		ChainId:                 c.ChainID,
		ChainName:               c.ChainName,
		ChainState:              questv1.QuestChainState(c.ChainState),
		TotalQuestCount:         c.TotalQuestCount,
		CompletedQuestCount:     c.CompletedQuestCount,
		ActiveQuestCfgId:        c.ActiveQuestCfgID,
		NextAvailableQuestCfgId: c.NextAvailableQuestCfgID,
	}
}

func rewardBundleToProto(b quest.RewardBundle) *apicommon.RewardBundle {
	if len(b.Items) == 0 && len(b.Resources) == 0 && b.RewardPackID == "" {
		return nil
	}
	items := make([]*apicommon.RewardItem, 0, len(b.Items))
	for _, it := range b.Items {
		items = append(items, &apicommon.RewardItem{ItemCfgId: it.ItemCfgID, Quantity: it.Quantity})
	}
	return &apicommon.RewardBundle{
		RewardPackId: b.RewardPackID,
		Items:        items,
		Resources:    resourceWalletToProto(contentWalletFromQuest(b.Resources)),
	}
}

func contentWalletFromQuest(m map[string]int64) content.ResourceWallet {
	var w content.ResourceWallet
	for k, v := range m {
		switch k {
		case "food":
			w.Food = v
		case "wood":
			w.Wood = v
		case "iron":
			w.Iron = v
		case "stone":
			w.Stone = v
		case "gold", "silver":
			w.Gold += v
		}
	}
	return w
}

func resourceWalletToProto(w content.ResourceWallet) *apicommon.ResourceWallet {
	return &apicommon.ResourceWallet{
		Food: w.Food, Wood: w.Wood, Iron: w.Iron, Stone: w.Stone, Gold: w.Gold,
	}
}

func shopOfferToProto(o shop.Offer) *shopv1.ShopOffer {
	return &shopv1.ShopOffer{
		OfferId:              o.OfferID,
		ShelfId:              o.ShelfID,
		ShelfName:            o.ShelfName,
		SortOrder:            o.SortOrder,
		ItemCfgId:            o.ItemCfgID,
		QuantityPerPurchase:  o.QuantityPerPurchase,
		PriceResources:       resourceWalletToProto(o.PriceResources),
		LimitType:            shopv1.PurchaseLimitType(o.LimitType),
		PurchaseLimit:        o.PurchaseLimit,
		PurchasedCount:       o.PurchasedCount,
		LimitResetsAtMs:      o.LimitResetsAtMs,
		StockTotal:           o.StockTotal,
		StockRemaining:       o.StockRemaining,
		SoldOut:              o.SoldOut,
	}
}

func grantedItemsToProto(items []content.RewardItem) *apicommon.RewardBundle {
	out := make([]*apicommon.RewardItem, 0, len(items))
	for _, it := range items {
		out = append(out, &apicommon.RewardItem{ItemCfgId: it.ItemCfgID, Quantity: it.Qty})
	}
	return &apicommon.RewardBundle{Items: out}
}
