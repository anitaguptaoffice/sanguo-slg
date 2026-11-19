package api

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// creditMarchLoot settles a won battle's reward in the return transaction:
// wallet resources, bag items and the leading hero's experience. The row is
// consumed so a replayed return cannot pay twice.
func creditMarchLoot(ctx context.Context, access *recruittx.Access, binding *recruittx.Binding, schema string, c march.ReturnCandidate) error {
	table := func(name string) string { return pgx.Identifier{schema, name}.Sanitize() }
	var food, wood, stone, iron, gold, heroExp int64
	var rawItems []byte
	err := access.Scan(ctx, binding, `SELECT food,wood,stone,iron,gold,items,hero_exp FROM `+table("march_loot")+`
		WHERE server_id = $1 AND march_id = $2`, []any{c.ServerID, c.MarchID},
		&food, &wood, &stone, &iron, &gold, &rawItems, &heroExp)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err = access.Exec(ctx, binding, `UPDATE `+table("player_wallet")+`
		SET food = food + $3, wood = wood + $4, stone = stone + $5, iron = iron + $6, gold = gold + $7
		WHERE server_id = $1 AND player_id = $2`,
		c.ServerID, c.PlayerID, food, wood, stone, iron, gold); err != nil {
		return err
	}
	var items []march.LootItem
	if len(rawItems) > 0 {
		if err = json.Unmarshal(rawItems, &items); err != nil {
			return err
		}
	}
	for _, item := range items {
		if item.ItemCfgID <= 0 || item.Count <= 0 {
			continue
		}
		if _, err = access.Exec(ctx, binding, `INSERT INTO `+table("player_item")+`(server_id,player_id,item_cfg_id,quantity)
			VALUES($1,$2,$3,$4)
			ON CONFLICT (server_id,player_id,item_cfg_id) DO UPDATE SET quantity = `+table("player_item")+`.quantity + EXCLUDED.quantity`,
			c.ServerID, c.PlayerID, item.ItemCfgID, item.Count); err != nil {
			return err
		}
	}
	if heroExp > 0 {
		var heroID int64
		err = access.Scan(ctx, binding, `SELECT COALESCE(hero_ids[1],0) FROM `+table("field_army")+`
			WHERE server_id = $1 AND army_id = $2`, []any{c.ServerID, c.ArmyID}, &heroID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if heroID > 0 {
			if _, err = access.Exec(ctx, binding, `UPDATE `+table("player_hero")+` SET exp = exp + $3
				WHERE server_id = $1 AND hero_id = $2 AND player_id = $4`,
				c.ServerID, heroID, heroExp, c.PlayerID); err != nil {
				return err
			}
		}
	}
	_, err = access.Exec(ctx, binding, `DELETE FROM `+table("march_loot")+` WHERE server_id = $1 AND march_id = $2`,
		c.ServerID, c.MarchID)
	return err
}
