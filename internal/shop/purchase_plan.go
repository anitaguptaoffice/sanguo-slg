package shop

import (
	"math"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
)

// PurchaseState contains raw durable facts acquired after wallet/items. Its
// transaction/store/intent identity is private and cannot be supplied by clients.
type PurchaseState struct{ data *purchaseState }
type purchaseState struct {
	intent       *purchaseIntent
	store        *PGStore
	tx           pgx.Tx
	sold         int64
	total, daily int32
	period       time.Time
	recorded     bool
}

// PurchasePlan is immutable. Accessors copy every slice/map; never use a shelf
// response or shared CONTENT cache to derive this plan's costs or final view.
type PurchasePlan struct {
	intent       *purchaseIntent
	state        *purchaseState
	at           time.Time
	total, daily int32
	offer        Offer
}

func (p PurchasePlan) Player() content.PlayerRef {
	if p.intent == nil {
		return content.PlayerRef{}
	}
	return p.intent.player
}
func (p PurchasePlan) OfferID() int32 {
	if p.intent == nil {
		return 0
	}
	return p.intent.entry.OfferID
}
func (p PurchasePlan) Count() int32 {
	if p.intent == nil {
		return 0
	}
	return p.intent.count
}
func (p PurchasePlan) DecisionTime() time.Time { return p.at }
func (p PurchasePlan) WalletCost() content.ResourceWallet {
	if p.intent == nil {
		return content.ResourceWallet{}
	}
	return p.intent.wallet
}
func (p PurchasePlan) ItemCosts() []content.Stack {
	if p.intent == nil {
		return nil
	}
	return append([]content.Stack(nil), p.intent.items...)
}
func (p PurchasePlan) Reward() content.RewardPackage {
	if p.intent == nil {
		return content.RewardPackage{}
	}
	return clonePackage(p.intent.reward)
}
func (p PurchasePlan) Offer() Offer {
	out := p.offer
	out.PriceItems = append([]content.RewardItem(nil), out.PriceItems...)
	return out
}

// PlanPurchase samples business-decision time once, AFTER LockPurchaseStateInTx
// (and the caller's wallet/item locks), but BEFORE allocator/receipt waits. This
// is not commit time. No mutex, cache, or database is accessed here.
func (s *Service) PlanPurchase(intent PurchaseIntent, state PurchaseState) (PurchasePlan, error) {
	if s == nil || intent.data == nil || intent.data.service != s || state.data == nil || state.data.intent != intent.data || state.data.recorded {
		return PurchasePlan{}, ErrPurchaseTransactionRequired
	}
	return planPurchase(intent.data, state.data, s.now())
}

// Pure arithmetic/calendar decision on already-locked, raw durable facts.
func planPurchase(in *purchaseIntent, st *purchaseState, at time.Time) (PurchasePlan, error) {
	out := PurchasePlan{intent: in, state: st, at: at}
	if st.total < 0 || st.daily < 0 || st.sold < 0 || at.IsZero() {
		return out, ErrInvalidPurchase
	}
	daily := st.daily
	if !sameCalendarDay(st.period, at) {
		daily = 0
	}
	kind, limit := limitMeta(in.entry)
	purchased := int32(0)
	if kind == PurchaseLimitDaily {
		purchased = daily
	} else if kind == PurchaseLimitLifetime {
		purchased = st.total
	}
	if limit > 0 && int64(in.count) > int64(limit)-int64(purchased) {
		return out, ErrPurchaseLimitExceeded
	}
	out.total = st.total
	if int64(in.count) > math.MaxInt32-int64(out.total) {
		return out, ErrPurchaseOverflow
	}
	out.total += in.count
	bump := dailyBumpQty(kind, in.count)
	if int64(bump) > math.MaxInt32-int64(daily) {
		return out, ErrPurchaseOverflow
	}
	out.daily = daily + bump
	rem := remainingStock(stockTotal(in.entry), st.sold)
	if rem >= 0 {
		if in.count > rem {
			return out, ErrSoldOut
		}
		rem -= in.count
	}
	if kind != PurchaseLimitNone {
		purchased += in.count
	}
	out.offer = offerFromFacts(in.entry, rem, purchased, at)
	return out, nil
}

func remainingStock(total int32, sold int64) int32 {
	if total < 0 {
		return -1
	}
	if sold >= int64(total) {
		return 0
	}
	return int32(int64(total) - sold)
}
func offerFromFacts(e CatalogEntry, remaining, purchased int32, at time.Time) Offer {
	kind, limit := limitMeta(e)
	var reset int64
	if kind == PurchaseLimitDaily {
		reset = startOfDay(at).AddDate(0, 0, 1).UnixMilli()
	}
	return Offer{OfferID: e.OfferID, ShelfID: e.ShelfID, ShelfName: e.ShelfName, SortOrder: e.SortOrder,
		ItemCfgID: e.ItemCfgID, QuantityPerPurchase: e.QuantityPerPurchase,
		PriceResources: priceWallet(e.Price), PriceItems: append([]content.RewardItem(nil), e.Price.Items...),
		StockTotal: stockTotal(e), StockRemaining: remaining, LimitType: kind, PurchaseLimit: limit,
		PurchasedCount: purchased, LimitResetsAtMs: reset, SoldOut: remaining == 0 || (limit > 0 && purchased >= limit)}
}
