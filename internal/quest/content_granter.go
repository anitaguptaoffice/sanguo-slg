package quest

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// ContentGranter adapts content.Service.Grant to quest.RewardGranter.
type ContentGranter struct {
	content *content.Service
}

// NewContentGranter wraps a content service for quest claim rewards.
func NewContentGranter(s *content.Service) *ContentGranter {
	return &ContentGranter{content: s}
}

// GrantQuestReward applies cfg rewards via content grant (idempotent per key).
func (g *ContentGranter) GrantQuestReward(ctx context.Context, req GrantRequest) (RewardBundle, error) {
	if g == nil || g.content == nil {
		return RewardBundle{}, ErrGrantFailed
	}
	_ = ctx
	p := content.PlayerRef{ServerID: req.ServerID, PlayerID: req.PlayerID}
	pkg := ToContentPackage(req.Rewards)
	if _, err := g.content.Grant(p, pkg, req.IdempotencyKey); err != nil {
		return RewardBundle{}, err
	}
	return req.Rewards, nil
}

// ToContentPackage maps quest reward view to content.RewardPackage.
func ToContentPackage(b RewardBundle) content.RewardPackage {
	items := make([]content.RewardItem, 0, len(b.Items))
	for _, it := range b.Items {
		items = append(items, content.RewardItem{ItemCfgID: it.ItemCfgID, Qty: it.Quantity})
	}
	res := b.Resources
	if res == nil {
		res = map[string]int64{}
	}
	return content.RewardPackage{Resources: res, Items: items}
}

// FromContentPackage maps content grant JSON shape into quest RewardBundle.
func FromContentPackage(pkg content.RewardPackage) RewardBundle {
	items := make([]RewardItem, 0, len(pkg.Items))
	for _, it := range pkg.Items {
		items = append(items, RewardItem{ItemCfgID: it.ItemCfgID, Quantity: it.Qty})
	}
	return RewardBundle{Resources: pkg.Resources, Items: items}
}
