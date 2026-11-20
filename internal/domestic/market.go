package domestic

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrMarketUnavailable = errors.New("domestic: market unavailable")
	ErrMarketLevel       = errors.New("domestic: market level required")
	ErrMarketAmount      = errors.New("domestic: invalid market amount")
	ErrMarketGold        = errors.New("domestic: insufficient gold")
	ErrMarketResource    = errors.New("domestic: insufficient resource")
	ErrMarketPrice       = errors.New("domestic: offer price out of range")
	ErrMarketCapacity    = errors.New("domestic: market capacity exhausted")
	ErrMarketDistance    = errors.New("domestic: offer out of caravan range")
	ErrMarketOffer       = errors.New("domestic: market offer unavailable")
	ErrMarketSelf        = errors.New("domestic: cannot trade with yourself")
)

// MarketBasePricesMilli is the NPC merchant price per resource in thousandths
// of one gold: food, wood, stone, iron.
var MarketBasePricesMilli = [4]int64{100, 100, 200, 250}

const (
	marketCfgID        int32 = 12
	marketMaxRangeHrs  int32 = 24
	marketGridDistance int64 = 6000
	marketSpeed        int64 = 360
	marketGridPerHour  int64 = 3600 * marketSpeed / marketGridDistance
)

// Market exposes NPC exchange and same-server player offers. It uses the same
// player_wallet as production and city creation.
type Market struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func NewMarket(pool *pgxpool.Pool, now func() time.Time) *Market {
	if now == nil {
		now = time.Now
	}
	return &Market{Pool: pool, Now: now}
}

type MarketCity struct {
	PlayerID int64
	Name     string
	X, Y     int32
	Level    int32
}

type MarketOfferView struct {
	OfferID        int64
	SellerCityID   int64
	SellerName     string
	ResourceType   int32
	Amount         int64
	PriceMilli     int64
	GoldTotal      int64
	Distance       int32
	DeliverSeconds int64
	Own            bool
}

type MarketDeliveryView struct {
	OfferID      int64
	SellerCityID int64
	ResourceType int32
	Amount       int64
	GoldTotal    int64
	DeliverAt    time.Time
}

type MarketSnapshot struct {
	MarketLevel      int32
	ListingCapacity  int32
	CaravanCapacity  int32
	MaxListingAmount int64
	PricesMilli      [4]int64
	Offers           []MarketOfferView
	OwnOffers        []MarketOfferView
	Deliveries       []MarketDeliveryView
	Gold             int64
	Wallet           Resources
}

type MerchantResult struct {
	Gold     int64
	GoldDiff int64
	Wallet   Resources
}

type OfferResult struct {
	Offer  MarketOfferView
	Gold   int64
	Wallet Resources
}

type BuyOfferResult struct {
	OfferID   int64
	DeliverAt time.Time
	Gold      int64
	Wallet    Resources
}

func MarketBuyCost(amount, priceMilli int64) int64 {
	if amount <= 0 || priceMilli <= 0 || amount > math.MaxInt64/priceMilli {
		return math.MaxInt64
	}
	return (amount*priceMilli + 999) / 1000
}

func MarketSellGain(amount, priceMilli int64) int64 {
	if amount <= 0 || priceMilli <= 0 || amount > math.MaxInt64/priceMilli {
		return 0
	}
	return amount * priceMilli / 1000
}

func MarketDistance(x1, y1, x2, y2 int32) int32 {
	dx, dy := int64(x2-x1), int64(y2-y1)
	d := math.Sqrt(float64(dx*dx + dy*dy))
	if d < 1 {
		return 1
	}
	return int32(math.Ceil(d))
}

func MarketDeliverSeconds(distance int32) int64 {
	if distance <= 0 {
		return 0
	}
	return int64(math.Ceil(float64(distance) * float64(marketGridDistance) / float64(marketSpeed)))
}

func marketColumn(resourceType int32) (string, error) {
	switch resourceType {
	case 0:
		return "food", nil
	case 1:
		return "wood", nil
	case 2:
		return "stone", nil
	case 3:
		return "iron", nil
	}
	return "", ErrMarketUnavailable
}

func (m *Market) marketCity(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) (MarketCity, error) {
	var c MarketCity
	err := tx.QueryRow(ctx, `SELECT player_id,name,x,y FROM player_city WHERE server_id=$1 AND city_id=$2`,
		serverID, cityID).Scan(&c.PlayerID, &c.Name, &c.X, &c.Y)
	if err != nil {
		return MarketCity{}, err
	}
	err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`, serverID, cityID, marketCfgID).Scan(&c.Level)
	return c, err
}

func scanWallet(row pgx.Row) (Resources, int64, error) {
	var w Resources
	var gold int64
	err := row.Scan(&w.Food, &w.Wood, &w.Stone, &w.Iron, &gold)
	return w, gold, err
}

func (m *Market) wallet(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64, lock bool) (Resources, int64, error) {
	q := `SELECT food,wood,stone,iron,gold FROM player_wallet WHERE server_id=$1 AND player_id=$2`
	if lock {
		q += ` FOR UPDATE`
	}
	return scanWallet(tx.QueryRow(ctx, q, serverID, playerID))
}

func (m *Market) offerCount(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64, buyer bool) (int32, error) {
	q := `SELECT count(*) FROM market_offer WHERE server_id=$1 AND seller_player_id=$2 AND status IN (0,1)`
	if buyer {
		q = `SELECT count(*) FROM market_offer WHERE server_id=$1 AND buyer_player_id=$2 AND status=1`
	}
	var n int32
	err := tx.QueryRow(ctx, q, serverID, playerID).Scan(&n)
	return n, err
}

func (m *Market) settleDeliveries(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64, now time.Time) error {
	rows, err := tx.Query(ctx, `SELECT offer_id,buyer_player_id,seller_player_id,resource_type,amount,gold_total
		FROM market_offer WHERE server_id=$1 AND status=1 AND deliver_at<=$3
		AND (buyer_player_id=$2 OR seller_player_id=$2)
		ORDER BY offer_id FOR UPDATE`, serverID, playerID, now.UTC())
	if err != nil {
		return err
	}
	type due struct {
		id           int64
		buyer        int64
		seller       int64
		resourceType int32
		amount, gold int64
	}
	var pending []due
	for rows.Next() {
		var d due
		if err := rows.Scan(&d.id, &d.buyer, &d.seller, &d.resourceType, &d.amount, &d.gold); err != nil {
			rows.Close()
			return err
		}
		pending = append(pending, d)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()
	for _, d := range pending {
		col, err := marketColumn(d.resourceType)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET `+col+`=`+col+`+$3 WHERE server_id=$1 AND player_id=$2`,
			serverID, d.buyer, d.amount); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold+$3 WHERE server_id=$1 AND player_id=$2`,
			serverID, d.seller, d.gold); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `UPDATE market_offer SET status=2 WHERE server_id=$1 AND offer_id=$2 AND status=1`,
			serverID, d.id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrMarketOffer
		}
	}
	return nil
}

func (m *Market) Snapshot(ctx context.Context, serverID int32, playerID, cityID int64) (MarketSnapshot, error) {
	if m == nil || m.Pool == nil {
		return MarketSnapshot{}, ErrMarketUnavailable
	}
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return MarketSnapshot{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	city, err := m.marketCity(ctx, tx, serverID, cityID)
	if err != nil {
		return MarketSnapshot{}, err
	}
	if city.PlayerID != playerID {
		return MarketSnapshot{}, ErrCityNotFound
	}
	now := m.Now().UTC()
	if err := m.settleDeliveries(ctx, tx, serverID, playerID, now); err != nil {
		return MarketSnapshot{}, err
	}
	out := MarketSnapshot{
		MarketLevel:      city.Level,
		ListingCapacity:  city.Level,
		CaravanCapacity:  city.Level,
		MaxListingAmount: int64(city.Level) * 100000,
		PricesMilli:      MarketBasePricesMilli,
	}
	if out.Wallet, out.Gold, err = m.wallet(ctx, tx, serverID, playerID, false); err != nil {
		return MarketSnapshot{}, err
	}
	rows, err := tx.Query(ctx, `SELECT o.offer_id,o.seller_city_id,p.display_name,o.resource_type,o.amount,
		o.price_milli,o.gold_total,c.x,c.y
		FROM market_offer o
		JOIN player_city c ON c.server_id=o.server_id AND c.city_id=o.seller_city_id
		JOIN player p ON p.server_id=o.server_id AND p.player_id=o.seller_player_id
		WHERE o.server_id=$1 AND o.status=0 AND o.seller_player_id<>$2
		AND ((c.x::bigint-$3)*(c.x::bigint-$3)+(c.y::bigint-$4)*(c.y::bigint-$4)) <= (o.range_hours::bigint*$5)*(o.range_hours::bigint*$5)
		ORDER BY ((c.x::bigint-$3)*(c.x::bigint-$3)+(c.y::bigint-$4)*(c.y::bigint-$4)),o.offer_id LIMIT 100`,
		serverID, playerID, city.X, city.Y, marketGridPerHour)
	if err != nil {
		return MarketSnapshot{}, err
	}
	for rows.Next() {
		var v MarketOfferView
		var x, y int32
		if err := rows.Scan(&v.OfferID, &v.SellerCityID, &v.SellerName, &v.ResourceType,
			&v.Amount, &v.PriceMilli, &v.GoldTotal, &x, &y); err != nil {
			rows.Close()
			return MarketSnapshot{}, err
		}
		v.Distance = MarketDistance(city.X, city.Y, x, y)
		v.DeliverSeconds = MarketDeliverSeconds(v.Distance)
		out.Offers = append(out.Offers, v)
	}
	if err := rows.Err(); err != nil {
		return MarketSnapshot{}, err
	}
	rows.Close()
	rows, err = tx.Query(ctx, `SELECT o.offer_id,o.seller_city_id,p.display_name,o.resource_type,o.amount,
		o.price_milli,o.gold_total,c.x,c.y
		FROM market_offer o
		JOIN player_city c ON c.server_id=o.server_id AND c.city_id=o.seller_city_id
		JOIN player p ON p.server_id=o.server_id AND p.player_id=o.seller_player_id
		WHERE o.server_id=$1 AND o.status=0 AND o.seller_player_id=$2 ORDER BY o.offer_id`,
		serverID, playerID)
	if err != nil {
		return MarketSnapshot{}, err
	}
	for rows.Next() {
		var v MarketOfferView
		var x, y int32
		if err := rows.Scan(&v.OfferID, &v.SellerCityID, &v.SellerName, &v.ResourceType,
			&v.Amount, &v.PriceMilli, &v.GoldTotal, &x, &y); err != nil {
			rows.Close()
			return MarketSnapshot{}, err
		}
		v.Own = true
		out.OwnOffers = append(out.OwnOffers, v)
	}
	if err := rows.Err(); err != nil {
		return MarketSnapshot{}, err
	}
	rows.Close()
	rows, err = tx.Query(ctx, `SELECT offer_id,seller_city_id,resource_type,amount,gold_total,deliver_at
		FROM market_offer WHERE server_id=$1 AND buyer_player_id=$2 AND status=1 ORDER BY deliver_at,offer_id`,
		serverID, playerID)
	if err != nil {
		return MarketSnapshot{}, err
	}
	for rows.Next() {
		var v MarketDeliveryView
		if err := rows.Scan(&v.OfferID, &v.SellerCityID, &v.ResourceType, &v.Amount, &v.GoldTotal, &v.DeliverAt); err != nil {
			rows.Close()
			return MarketSnapshot{}, err
		}
		out.Deliveries = append(out.Deliveries, v)
	}
	if err := rows.Err(); err != nil {
		return MarketSnapshot{}, err
	}
	rows.Close()
	if err := tx.Commit(ctx); err != nil {
		return MarketSnapshot{}, err
	}
	return out, nil
}

func (m *Market) BuyFromMerchant(ctx context.Context, serverID int32, playerID, cityID int64, resourceType int32, amount int64) (MerchantResult, error) {
	return m.merchant(ctx, serverID, playerID, cityID, resourceType, amount, true)
}

func (m *Market) SellToMerchant(ctx context.Context, serverID int32, playerID, cityID int64, resourceType int32, amount int64) (MerchantResult, error) {
	return m.merchant(ctx, serverID, playerID, cityID, resourceType, amount, false)
}

func (m *Market) merchant(ctx context.Context, serverID int32, playerID, cityID int64, resourceType int32, amount int64, buy bool) (MerchantResult, error) {
	if m == nil || m.Pool == nil {
		return MerchantResult{}, ErrMarketUnavailable
	}
	col, err := marketColumn(resourceType)
	if err != nil {
		return MerchantResult{}, err
	}
	if amount <= 0 {
		return MerchantResult{}, ErrMarketAmount
	}
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return MerchantResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	city, err := m.marketCity(ctx, tx, serverID, cityID)
	if err != nil {
		return MerchantResult{}, err
	}
	if city.PlayerID != playerID {
		return MerchantResult{}, ErrCityNotFound
	}
	if city.Level < 1 {
		return MerchantResult{}, ErrMarketLevel
	}
	price := MarketBasePricesMilli[resourceType]
	var goldDelta int64
	if buy {
		goldDelta = MarketBuyCost(amount, price)
		if goldDelta < 1 || goldDelta > int64(city.Level)*100000 {
			return MerchantResult{}, ErrMarketAmount
		}
	} else {
		goldDelta = MarketSellGain(amount, price)
		if goldDelta < 1 || goldDelta > int64(city.Level)*100000 {
			return MerchantResult{}, ErrMarketAmount
		}
	}
	wallet, gold, err := m.wallet(ctx, tx, serverID, playerID, true)
	if err != nil {
		return MerchantResult{}, err
	}
	if buy {
		if gold < goldDelta {
			return MerchantResult{}, ErrMarketGold
		}
		gold -= goldDelta
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3,`+col+`=`+col+`+$4 WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID, gold, amount); err != nil {
			return MerchantResult{}, err
		}
		addResource(&wallet, resourceType, amount)
		goldDelta = -goldDelta
	} else {
		if resourceAmount(wallet, resourceType) < amount {
			return MerchantResult{}, ErrMarketResource
		}
		gold += goldDelta
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3,`+col+`=`+col+`-$4 WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID, gold, amount); err != nil {
			return MerchantResult{}, err
		}
		addResource(&wallet, resourceType, -amount)
	}
	if err := tx.Commit(ctx); err != nil {
		return MerchantResult{}, err
	}
	return MerchantResult{Gold: gold, GoldDiff: goldDelta, Wallet: wallet}, nil
}

func (m *Market) CreateOffer(ctx context.Context, serverID int32, playerID, cityID int64, resourceType int32, amount, priceMilli int64, hours int32) (OfferResult, error) {
	if m == nil || m.Pool == nil {
		return OfferResult{}, ErrMarketUnavailable
	}
	col, err := marketColumn(resourceType)
	if err != nil {
		return OfferResult{}, err
	}
	if amount <= 0 || priceMilli <= 0 || hours < 1 || hours > marketMaxRangeHrs {
		return OfferResult{}, ErrMarketAmount
	}
	base := MarketBasePricesMilli[resourceType]
	if priceMilli < base*79/100 || priceMilli > (base*121+99)/100 {
		return OfferResult{}, ErrMarketPrice
	}
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return OfferResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	city, err := m.marketCity(ctx, tx, serverID, cityID)
	if err != nil {
		return OfferResult{}, err
	}
	if city.PlayerID != playerID {
		return OfferResult{}, ErrCityNotFound
	}
	if city.Level < 1 {
		return OfferResult{}, ErrMarketLevel
	}
	if amount > int64(city.Level)*100000 {
		return OfferResult{}, ErrMarketAmount
	}
	wallet, gold, err := m.wallet(ctx, tx, serverID, playerID, true)
	if err != nil {
		return OfferResult{}, err
	}
	n, err := m.offerCount(ctx, tx, serverID, playerID, false)
	if err != nil {
		return OfferResult{}, err
	}
	if n >= city.Level {
		return OfferResult{}, ErrMarketCapacity
	}
	if resourceAmount(wallet, resourceType) < amount {
		return OfferResult{}, ErrMarketResource
	}
	goldTotal := MarketBuyCost(amount, priceMilli)
	if goldTotal < 1 {
		return OfferResult{}, ErrMarketPrice
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET `+col+`=`+col+`-$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, amount); err != nil {
		return OfferResult{}, err
	}
	addResource(&wallet, resourceType, -amount)
	var id int64
	if err := tx.QueryRow(ctx, `INSERT INTO market_offer
		(server_id,seller_player_id,seller_city_id,resource_type,amount,price_milli,gold_total,range_hours)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING offer_id`,
		serverID, playerID, cityID, resourceType, amount, priceMilli, goldTotal, hours).Scan(&id); err != nil {
		return OfferResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return OfferResult{}, err
	}
	return OfferResult{
		Offer: MarketOfferView{OfferID: id, SellerCityID: cityID, SellerName: city.Name,
			ResourceType: resourceType, Amount: amount, PriceMilli: priceMilli, GoldTotal: goldTotal, Own: true},
		Gold: gold, Wallet: wallet,
	}, nil
}

func (m *Market) CancelOffer(ctx context.Context, serverID int32, playerID, cityID, offerID int64) (MerchantResult, error) {
	if m == nil || m.Pool == nil {
		return MerchantResult{}, ErrMarketUnavailable
	}
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return MerchantResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	city, err := m.marketCity(ctx, tx, serverID, cityID)
	if err != nil {
		return MerchantResult{}, err
	}
	if city.PlayerID != playerID {
		return MerchantResult{}, ErrCityNotFound
	}
	var resourceType int32
	var amount int64
	err = tx.QueryRow(ctx, `SELECT resource_type,amount FROM market_offer
		WHERE server_id=$1 AND offer_id=$2 AND seller_player_id=$3 AND seller_city_id=$4 AND status=0 FOR UPDATE`,
		serverID, offerID, playerID, cityID).Scan(&resourceType, &amount)
	if errors.Is(err, pgx.ErrNoRows) {
		return MerchantResult{}, ErrMarketOffer
	}
	if err != nil {
		return MerchantResult{}, err
	}
	col, err := marketColumn(resourceType)
	if err != nil {
		return MerchantResult{}, err
	}
	wallet, gold, err := m.wallet(ctx, tx, serverID, playerID, true)
	if err != nil {
		return MerchantResult{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET `+col+`=`+col+`+$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, amount); err != nil {
		return MerchantResult{}, err
	}
	addResource(&wallet, resourceType, amount)
	if _, err := tx.Exec(ctx, `UPDATE market_offer SET status=3 WHERE server_id=$1 AND offer_id=$2 AND status=0`,
		serverID, offerID); err != nil {
		return MerchantResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return MerchantResult{}, err
	}
	return MerchantResult{Gold: gold, Wallet: wallet}, nil
}

func (m *Market) BuyOffer(ctx context.Context, serverID int32, playerID, cityID, offerID int64) (BuyOfferResult, error) {
	if m == nil || m.Pool == nil {
		return BuyOfferResult{}, ErrMarketUnavailable
	}
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return BuyOfferResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	buyer, err := m.marketCity(ctx, tx, serverID, cityID)
	if err != nil {
		return BuyOfferResult{}, err
	}
	if buyer.PlayerID != playerID {
		return BuyOfferResult{}, ErrCityNotFound
	}
	if buyer.Level < 1 {
		return BuyOfferResult{}, ErrMarketLevel
	}
	var sellerPlayerID, sellerCityID, goldTotal int64
	var resourceType int32
	var rangeHours int32
	var sx, sy int32
	err = tx.QueryRow(ctx, `SELECT o.seller_player_id,o.seller_city_id,o.resource_type,o.gold_total,o.range_hours,c.x,c.y
		FROM market_offer o JOIN player_city c ON c.server_id=o.server_id AND c.city_id=o.seller_city_id
		WHERE o.server_id=$1 AND o.offer_id=$2 AND o.status=0 FOR UPDATE OF o`,
		serverID, offerID).Scan(&sellerPlayerID, &sellerCityID, &resourceType, &goldTotal, &rangeHours, &sx, &sy)
	if errors.Is(err, pgx.ErrNoRows) {
		return BuyOfferResult{}, ErrMarketOffer
	}
	if err != nil {
		return BuyOfferResult{}, err
	}
	if sellerPlayerID == playerID {
		return BuyOfferResult{}, ErrMarketSelf
	}
	wallet, gold, err := m.wallet(ctx, tx, serverID, playerID, true)
	if err != nil {
		return BuyOfferResult{}, err
	}
	n, err := m.offerCount(ctx, tx, serverID, playerID, true)
	if err != nil {
		return BuyOfferResult{}, err
	}
	if n >= buyer.Level {
		return BuyOfferResult{}, ErrMarketCapacity
	}
	distance := MarketDistance(buyer.X, buyer.Y, sx, sy)
	dx, dy := int64(sx-buyer.X), int64(sy-buyer.Y)
	maxRange := int64(rangeHours) * marketGridPerHour
	if dx*dx+dy*dy > maxRange*maxRange {
		return BuyOfferResult{}, ErrMarketDistance
	}
	if gold < goldTotal {
		return BuyOfferResult{}, ErrMarketGold
	}
	gold -= goldTotal
	now := m.Now().UTC()
	deliverAt := now.Add(time.Duration(MarketDeliverSeconds(distance)) * time.Second)
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, gold); err != nil {
		return BuyOfferResult{}, err
	}
	tag, err := tx.Exec(ctx, `UPDATE market_offer SET status=1,buyer_player_id=$3,buyer_city_id=$4,deliver_at=$5
		WHERE server_id=$1 AND offer_id=$2 AND status=0`, serverID, offerID, playerID, cityID, deliverAt)
	if err != nil {
		return BuyOfferResult{}, err
	}
	if tag.RowsAffected() != 1 {
		return BuyOfferResult{}, ErrMarketOffer
	}
	if err := tx.Commit(ctx); err != nil {
		return BuyOfferResult{}, err
	}
	return BuyOfferResult{OfferID: offerID, DeliverAt: deliverAt, Gold: gold, Wallet: wallet}, nil
}

func resourceAmount(w Resources, resourceType int32) int64 {
	switch resourceType {
	case 0:
		return w.Food
	case 1:
		return w.Wood
	case 2:
		return w.Stone
	case 3:
		return w.Iron
	}
	return 0
}

func addResource(w *Resources, resourceType int32, delta int64) {
	switch resourceType {
	case 0:
		w.Food += delta
	case 1:
		w.Wood += delta
	case 2:
		w.Stone += delta
	case 3:
		w.Iron += delta
	}
}
