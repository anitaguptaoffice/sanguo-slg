package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidGrantSource   = errors.New("content: invalid item grant source")
	ErrGrantReceiptConflict = errors.New("content: grant receipt already exists")
	ErrGrantIDExhausted     = errors.New("content: grant identity exhausted")
	ErrGrantIDContention    = errors.New("content: grant identity allocation contention")
)

// ItemGrantSource identifies a new server-planned purchase, not a client retry.
type ItemGrantSource struct {
	OfferID    int32
	PurchaseID int64
}

// SupportsItemTransactionsFor checks exact startup-only pool/catalog provenance.
// Like UseStore, persistence/catalog wiring must not change during requests.
func (s *Service) SupportsItemTransactionsFor(pool *pgxpool.Pool, catalog *Catalog) bool {
	return pool != nil && catalog != nil && s.SupportsItemTransactions() &&
		s.store.(*PGStore).Pool == pool && s.catalog == catalog
}

// CreateItemGrantInTx creates an item-only SHOP receipt and reward using only tx.
// The caller must validate the actor, use the bound pool at READ COMMITTED, and
// lock its existing wallet before other business locks. This method re-locks that
// wallet (never creates it), then validates the durable post-debit bag. It neither
// finishes transactions nor touches caches. Roll back on ANY error, even after
// partial writes; no existing receipt, including an exact match, is success here.
func (s *Service) CreateItemGrantInTx(ctx context.Context, tx pgx.Tx, player PlayerRef, pkg RewardPackage, source ItemGrantSource) (GrantReceipt, error) {
	if !s.SupportsItemTransactions() || tx == nil {
		return GrantReceipt{}, ErrItemTransactionsUnsupported
	}
	if player.ServerID <= 0 || player.PlayerID <= 0 {
		return GrantReceipt{}, ErrInvalidPlayer
	}
	if source.OfferID <= 0 || source.PurchaseID <= 0 {
		return GrantReceipt{}, ErrInvalidGrantSource
	}
	if len(pkg.Resources) != 0 || len(pkg.Items) == 0 || s.catalog == nil || s.catalog.BagMaxDistinctItems <= 0 {
		return GrantReceipt{}, ErrInvalidReward
	}
	if err := ctx.Err(); err != nil {
		return GrantReceipt{}, err
	}
	var locked int
	if err := tx.QueryRow(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, player.ServerID, player.PlayerID).Scan(&locked); err != nil {
		return GrantReceipt{}, err
	}
	stacks, err := loadBagInTx(ctx, tx, player)
	if err != nil {
		return GrantReceipt{}, err
	}
	bag := make(map[int32]int32, len(stacks))
	for _, st := range stacks {
		bag[st.ItemCfgID] = st.Quantity
	}
	touched := make(map[int32]bool)
	for _, item := range pkg.Items {
		if item.ItemCfgID <= 0 || item.Qty <= 0 {
			return GrantReceipt{}, ErrInvalidReward
		}
		def, ok := s.catalog.Items[item.ItemCfgID]
		if !ok {
			return GrantReceipt{}, ErrUnknownItem
		}
		if bag[item.ItemCfgID] == 0 && len(bag) >= int(s.catalog.BagMaxDistinctItems) {
			return GrantReceipt{}, ErrBagFull
		}
		next := int64(bag[item.ItemCfgID]) + int64(item.Qty)
		if next > int64(def.MaxStack) {
			return GrantReceipt{}, ErrStackLimit
		}
		bag[item.ItemCfgID], touched[item.ItemCfgID] = int32(next), true
	}
	// Preserve nil/empty fields, duplicate items and ordering in the exact receipt.
	raw, err := json.Marshal(pkg)
	if err != nil {
		return GrantReceipt{}, err
	}
	id, err := reserveItemGrantInTx(ctx, tx, player, raw, source)
	if err != nil {
		return GrantReceipt{}, err
	}
	ids := make([]int32, 0, len(touched))
	for id := range touched {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		if _, err := tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES($1,$2,$3,$4) ON CONFLICT(server_id,player_id,item_cfg_id) DO UPDATE SET quantity=EXCLUDED.quantity`, player.ServerID, player.PlayerID, id, bag[id]); err != nil {
			return GrantReceipt{}, err
		}
	}
	if err := ctx.Err(); err != nil {
		return GrantReceipt{}, err
	}
	return GrantReceipt{GrantID: id, Rewards: pkg}, nil
}

func reserveItemGrantInTx(ctx context.Context, tx pgx.Tx, p PlayerRef, raw []byte, source ItemGrantSource) (int64, error) {
	key := fmt.Sprintf("shop:%d:%d", p.PlayerID, source.PurchaseID)
	ref := fmt.Sprintf("offer:%d:purchase:%d", source.OfferID, source.PurchaseID)
	// Existing CONTENT/GM writers independently allocate MAX+1. Retry only the
	// identity reservation, never business writes, transactions or commit. Fresh
	// READ COMMITTED snapshots see a conflicting writer after its commit.
	for attempt := 0; attempt < 8; attempt++ {
		var high, id int64
		if err := tx.QueryRow(ctx, `SELECT GREATEST(COALESCE(MAX(grant_id),0),0) FROM reward_grant_queue WHERE server_id=$1`, p.ServerID).Scan(&high); err != nil {
			return 0, err
		}
		if high == math.MaxInt64 {
			return 0, ErrGrantIDExhausted
		}
		err := tx.QueryRow(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key,completed_at) VALUES($1,$2,$3,'shop',$4,$5,2,$6,now()) ON CONFLICT(server_id,grant_id) DO NOTHING RETURNING grant_id`, p.ServerID, high+1, p.PlayerID, ref, raw, key).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			continue // A simultaneous key conflict may be masked; never success.
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_reward_grant_idempotency" {
			return 0, ErrGrantReceiptConflict
		}
		return id, err
	}
	return 0, ErrGrantIDContention
}
