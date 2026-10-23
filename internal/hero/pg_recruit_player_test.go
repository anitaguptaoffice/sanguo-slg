package hero

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type pgRecruitInventory struct {
	pool    *pgxpool.Pool
	content *content.Service
}

func (p *pgRecruitInventory) LoadWalletAndItems(ctx context.Context, ref PlayerRef) (Resources, map[int32]int32, error) {
	cref := content.PlayerRef{ServerID: ref.ServerID, PlayerID: ref.PlayerID}
	var wallet Resources
	err := p.pool.QueryRow(ctx, `
		SELECT food, wood, iron, stone FROM player_wallet
		WHERE server_id = $1 AND player_id = $2`,
		ref.ServerID, ref.PlayerID,
	).Scan(&wallet.Food, &wallet.Wood, &wallet.Iron, &wallet.Stone)
	if errors.Is(err, pgx.ErrNoRows) {
		wallet = Resources{}
	} else if err != nil {
		return Resources{}, nil, err
	}
	if err := p.content.LoadPlayer(ctx, cref); err != nil {
		return Resources{}, nil, err
	}
	items := map[int32]int32{}
	for _, st := range p.content.List(cref) {
		items[st.ItemCfgID] = st.Quantity
	}
	return wallet, items, nil
}

func (p *pgRecruitInventory) ApplyRecruitSpend(ctx context.Context, ref PlayerRef, walletBefore Resources, itemsBefore map[int32]int32, walletAfter Resources, itemsAfter map[int32]int32) error {
	cost := content.ResourceWallet{
		Food: walletBefore.Food - walletAfter.Food, Wood: walletBefore.Wood - walletAfter.Wood,
		Stone: walletBefore.Stone - walletAfter.Stone, Iron: walletBefore.Iron - walletAfter.Iron,
	}
	if cost.Food > 0 || cost.Wood > 0 || cost.Stone > 0 || cost.Iron > 0 {
		tx, err := p.pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback(ctx) }()
		var have content.ResourceWallet
		err = tx.QueryRow(ctx, `
			SELECT food, wood, iron, stone, gold FROM player_wallet
			WHERE server_id = $1 AND player_id = $2 FOR UPDATE`,
			ref.ServerID, ref.PlayerID,
		).Scan(&have.Food, &have.Wood, &have.Iron, &have.Stone, &have.Gold)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInsufficientRes
		}
		if err != nil {
			return err
		}
		if have.Food < cost.Food || have.Wood < cost.Wood || have.Iron < cost.Iron || have.Stone < cost.Stone {
			return ErrInsufficientRes
		}
		after := content.ResourceWallet{
			Food: have.Food - cost.Food, Wood: have.Wood - cost.Wood,
			Iron: have.Iron - cost.Iron, Stone: have.Stone - cost.Stone, Gold: have.Gold,
		}
		_, err = tx.Exec(ctx, `
			UPDATE player_wallet SET food=$3, wood=$4, iron=$5, stone=$6, updated_at=NOW()
			WHERE server_id=$1 AND player_id=$2`,
			ref.ServerID, ref.PlayerID, after.Food, after.Wood, after.Iron, after.Stone)
		if err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	cref := content.PlayerRef{ServerID: ref.ServerID, PlayerID: ref.PlayerID}
	for id, beforeQty := range itemsBefore {
		afterQty := itemsAfter[id]
		if beforeQty > afterQty {
			if _, err := p.content.Remove(cref, id, beforeQty-afterQty); err != nil {
				if errors.Is(err, content.ErrInsufficientItems) {
					return ErrInsufficientItem
				}
				return err
			}
		}
	}
	return nil
}

func TestRecruitPlayerPGDeductsWalletAndItems(t *testing.T) {
	pool := openHeroTestDB(t)
	ctx := context.Background()
	applyHeroSchema(t, pool)

	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	contentSvc.UseStore(content.NewPGStore(pool))
	p := content.PlayerRef{ServerID: 1, PlayerID: 501}
	_, err = contentSvc.Grant(p, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: RecruitScrollID, Qty: 3}},
	}, "hero-003:grant")
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO player_wallet (server_id, player_id, food, wood, iron, stone, gold)
		VALUES (1, 501, 20000, 20000, 20000, 20000, 0)
		ON CONFLICT (server_id, player_id) DO UPDATE
		SET food = 20000, wood = 20000, iron = 20000, stone = 20000`)
	if err != nil {
		t.Fatal(err)
	}

	heroSvc := NewService()
	heroSvc.UseStore(NewPGStore(pool))
	inv := &pgRecruitInventory{pool: pool, content: contentSvc}
	href := PlayerRef{ServerID: 1, PlayerID: 501}
	tpl := heroSvc.Catalog[1001]
	res, err := heroSvc.RecruitPlayer(ctx, href, inv, RecruitRequest{TemplateCfgID: 1001})
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.TemplateCfgID != 1001 {
		t.Fatalf("hero %+v", res.Hero)
	}

	var food int64
	var scroll int32
	err = pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=501`).Scan(&food)
	if err != nil {
		t.Fatal(err)
	}
	if food != 20000-tpl.RecruitCost.Food {
		t.Fatalf("food after recruit: %d", food)
	}
	if err := contentSvc.LoadPlayer(ctx, p); err != nil {
		t.Fatal(err)
	}
	scroll, err = contentSvc.Get(p, RecruitScrollID)
	if err != nil || scroll != 2 {
		t.Fatalf("scroll qty=%d err=%v", scroll, err)
	}
	got, err := heroSvc.Store.GetHero(ctx, 1, res.Hero.HeroID)
	if err != nil || got == nil {
		t.Fatalf("pg hero %+v err=%v", got, err)
	}
}
