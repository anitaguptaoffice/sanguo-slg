package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
)

// grantAtomic keeps the durable reward, bag and wallet in the same transaction.
// Retry unique-ID races with the GM producer, which also allocates MAX(id)+1.
func (p *PGStore) grantAtomic(ctx context.Context, player PlayerRef, pkg RewardPackage, key string, cat *Catalog) (GrantResult, error) {
	for attempt := 0; attempt < 8; attempt++ {
		result, err := p.grantTx(ctx, player, pkg, key, cat)
		if !isUniqueViolation(err) {
			return result, err
		}
	}
	return GrantResult{}, fmt.Errorf("content: grant ID allocation contention")
}

func (p *PGStore) grantTx(ctx context.Context, player PlayerRef, pkg RewardPackage, key string, cat *Catalog) (GrantResult, error) {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return GrantResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	out := GrantResult{}
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, player.ServerID, player.PlayerID)
	if err != nil {
		return out, err
	}
	err = tx.QueryRow(ctx, `SELECT food,wood,iron,stone,gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, player.ServerID, player.PlayerID).Scan(&out.Wallet.Food, &out.Wallet.Wood, &out.Wallet.Iron, &out.Wallet.Stone, &out.Wallet.Gold)
	if err != nil {
		return out, err
	}
	raw, err := json.Marshal(pkg)
	if err != nil {
		return out, err
	}
	if key != "" {
		var owner int64
		var status int16
		var sameReward bool
		err = tx.QueryRow(ctx, `SELECT grant_id,player_id,status,rewards=$3::jsonb FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2 FOR UPDATE`, player.ServerID, key, raw).Scan(&out.GrantID, &owner, &status, &sameReward)
		if err == nil {
			if owner != player.PlayerID || !sameReward {
				return out, fmt.Errorf("content: idempotency key belongs to another reward")
			}
			out.Duplicate = status == GrantStatusSuccess
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return out, err
		}
	}
	if out.GrantID == 0 {
		if err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(grant_id),0)+1 FROM reward_grant_queue WHERE server_id=$1`, player.ServerID).Scan(&out.GrantID); err != nil {
			return out, err
		}
		if key != "" {
			_, err = tx.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key) VALUES($1,$2,$3,'grant','',$4,1,$5)`, player.ServerID, out.GrantID, player.PlayerID, raw, key)
			if err != nil {
				return out, err
			}
		}
	}
	rows, err := tx.Query(ctx, `SELECT item_cfg_id,quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND quantity>0 ORDER BY item_cfg_id FOR UPDATE`, player.ServerID, player.PlayerID)
	if err != nil {
		return out, err
	}
	bag := make(map[int32]int32)
	for rows.Next() {
		var stack Stack
		if err = rows.Scan(&stack.ItemCfgID, &stack.Quantity); err != nil {
			rows.Close()
			return out, err
		}
		bag[stack.ItemCfgID] = stack.Quantity
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	if !out.Duplicate {
		delta, err := resourceDeltaFromMap(pkg.Resources)
		if err != nil {
			return out, err
		}
		for _, item := range pkg.Items {
			def, ok := cat.Items[item.ItemCfgID]
			if !ok {
				return out, ErrUnknownItem
			}
			if item.Qty <= 0 {
				return out, ErrInvalidReward
			}
			if bag[item.ItemCfgID] == 0 && len(bag) >= int(cat.BagMaxDistinctItems) {
				return out, ErrBagFull
			}
			next := int64(bag[item.ItemCfgID]) + int64(item.Qty)
			if next > int64(def.MaxStack) {
				return out, ErrStackLimit
			}
			bag[item.ItemCfgID] = int32(next)
			_, err = tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES($1,$2,$3,$4) ON CONFLICT(server_id,player_id,item_cfg_id) DO UPDATE SET quantity=EXCLUDED.quantity`, player.ServerID, player.PlayerID, item.ItemCfgID, next)
			if err != nil {
				return out, err
			}
		}
		err = tx.QueryRow(ctx, `UPDATE player_wallet SET food=food+$3,wood=wood+$4,iron=iron+$5,stone=stone+$6,gold=gold+$7,updated_at=now() WHERE server_id=$1 AND player_id=$2 RETURNING food,wood,iron,stone,gold`, player.ServerID, player.PlayerID, delta.Food, delta.Wood, delta.Iron, delta.Stone, delta.Gold).Scan(&out.Wallet.Food, &out.Wallet.Wood, &out.Wallet.Iron, &out.Wallet.Stone, &out.Wallet.Gold)
		if err != nil {
			return out, err
		}
		if key != "" {
			_, err = tx.Exec(ctx, `UPDATE reward_grant_queue SET status=2,error_msg=NULL,completed_at=now() WHERE server_id=$1 AND grant_id=$2`, player.ServerID, out.GrantID)
			if err != nil {
				return out, err
			}
		}
	}
	for id, qty := range bag {
		out.Bag = append(out.Bag, Stack{ItemCfgID: id, Quantity: qty})
	}
	sort.Slice(out.Bag, func(i, j int) bool { return out.Bag[i].ItemCfgID < out.Bag[j].ItemCfgID })
	if err = tx.Commit(ctx); err != nil {
		return GrantResult{}, err
	}
	return out, nil
}

func (p *PGStore) loadWallet(ctx context.Context, player PlayerRef) (ResourceWallet, error) {
	var w ResourceWallet
	err := p.Pool.QueryRow(ctx, `SELECT food,wood,iron,stone,gold FROM player_wallet WHERE server_id=$1 AND player_id=$2`, player.ServerID, player.PlayerID).Scan(&w.Food, &w.Wood, &w.Iron, &w.Stone, &w.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return w, err
}
