package hero

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Historical partial-commit adapter retained to prove it is not called.
// Real natural-recruit success coverage belongs to the API-owned coordinator.
type pgRecruitInventory struct {
	loads, spends int
	pool          *pgxpool.Pool
	content       *content.Service
}

func (p *pgRecruitInventory) LoadWalletAndItems(ctx context.Context, ref PlayerRef) (Resources, map[int32]int32, error) {
	p.loads++
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
	p.spends++
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

func (p *pgRecruitInventory) ApplyLargessSpend(_ context.Context, _ PlayerRef, _ int64, _ int32) error {
	return nil
}

func (p *pgRecruitInventory) SpendItemQty(_ context.Context, ref PlayerRef, itemCfgID int32, qty int32) error {
	cref := content.PlayerRef{ServerID: ref.ServerID, PlayerID: ref.PlayerID}
	if _, err := p.content.Remove(cref, itemCfgID, qty); err != nil {
		if errors.Is(err, content.ErrInsufficientItems) {
			return ErrInsufficientItem
		}
		return err
	}
	return nil
}

func TestRecruitPlayerPGRejectsWithoutAssetEffects(t *testing.T) {
	pool := identityStore(t).Pool
	ctx := context.Background()

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
	res, err := heroSvc.RecruitPlayer(ctx, href, inv, RecruitRequest{TemplateCfgID: 1001})
	if !errors.Is(err, ErrRecruitTransactionRequired) || res.Hero != nil || inv.loads != 0 || inv.spends != 0 {
		t.Fatalf("legacy PG bypass: %+v %v loads=%d spends=%d", res, err, inv.loads, inv.spends)
	}
	var wallet Resources
	err = pool.QueryRow(ctx, `SELECT food, wood, stone, iron, gold FROM player_wallet WHERE server_id=1 AND player_id=501`).Scan(&wallet.Food, &wallet.Wood, &wallet.Stone, &wallet.Iron, &wallet.Gold)
	if err != nil || wallet != (Resources{Food: 20000, Wood: 20000, Stone: 20000, Iron: 20000}) {
		t.Fatalf("wallet changed: %+v %v", wallet, err)
	}
	var scroll, heroes int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=501 AND item_cfg_id=$1`, RecruitScrollID).Scan(&scroll); err != nil || scroll != 3 {
		t.Fatalf("scroll changed: %d %v", scroll, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM player_hero WHERE server_id=1 AND player_id=501`).Scan(&heroes); err != nil || heroes != 0 {
		t.Fatalf("hero created before rejection: %d %v", heroes, err)
	}
}
