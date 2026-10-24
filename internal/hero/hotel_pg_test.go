package hero

import (
	"context"
	"math/rand"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedHotelCityBuildings(t *testing.T, pool *pgxpool.Pool, serverID int32, cityID int64, hotelLevel, officeLevel int32) {
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO city_building (server_id, city_id, slot_key, building_cfg_id, level)
		VALUES ($1,$2,'hotel',8,$3), ($1,$2,'main_hall',1,$4)
		ON CONFLICT (server_id, city_id, slot_key) DO UPDATE SET level = EXCLUDED.level`,
		serverID, cityID, hotelLevel, officeLevel)
	if err != nil {
		t.Fatal(err)
	}
}

func TestRecruitHotelCandidatePG(t *testing.T) {
	pool := openHeroTestDB(t)
	ctx := context.Background()
	applyHeroSchema(t, pool)
	serverID := int32(1)
	playerID := int64(88001)
	cityID := int64(88002)
	seedHotelCityBuildings(t, pool, serverID, cityID, 2, 3)

	_, err := pool.Exec(ctx, `
		INSERT INTO player_wallet (server_id, player_id, food, wood, iron, stone, gold)
		VALUES ($1,$2,0,0,0,0,500000) ON CONFLICT (server_id, player_id) DO UPDATE SET gold=500000`,
		serverID, playerID)
	if err != nil {
		t.Fatal(err)
	}

	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	cref := content.PlayerRef{ServerID: serverID, PlayerID: playerID}
	if _, err := contentSvc.Grant(cref, content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: HotelRefreshItemCfgID, Qty: 1}}}, "test"); err != nil {
		t.Fatal(err)
	}

	svc := NewService()
	svc.UseStore(NewPGStore(pool))
	svc.HotelStore = NewPGHotelStore(pool)
	svc.RNG = rand.New(rand.NewSource(7))
	svc.SetClock(func() time.Time { return time.Unix(1_700_000_000, 0) })

	port := &pgHotelCity{pool: pool}
	p := PlayerRef{ServerID: serverID, PlayerID: playerID}
	city := CityRef{CityID: cityID}

	rows, err := svc.ListHotelCandidates(ctx, p, city, svc.HotelStore, port)
	if err != nil || len(rows) < 2 {
		t.Fatalf("list pool: len=%d err=%v", len(rows), err)
	}
	res, err := svc.RecruitHotelCandidate(ctx, p, city, svc.HotelStore, port, rows[0].CandidateID)
	if err != nil {
		t.Fatal(err)
	}
	got, err := svc.Store.GetHero(ctx, serverID, res.Hero.HeroID)
	if err != nil || got == nil || got.DisplayName == "" {
		t.Fatalf("persisted %+v err=%v", got, err)
	}

	// Fill capacity: office level 3 allows 3 heroes total.
	for i := 0; i < 2; i++ {
		rows, _ = svc.ListHotelCandidates(ctx, p, city, svc.HotelStore, port)
		if len(rows) == 0 {
			if err := svc.RefreshHotelPoolPaid(ctx, p, city, svc.HotelStore, port); err != nil {
				t.Fatal(err)
			}
			rows, _ = svc.ListHotelCandidates(ctx, p, city, svc.HotelStore, port)
		}
		if _, err := svc.RecruitHotelCandidate(ctx, p, city, svc.HotelStore, port, rows[0].CandidateID); err != nil {
			t.Fatal(err)
		}
	}
	rows, _ = svc.ListHotelCandidates(ctx, p, city, svc.HotelStore, port)
	if len(rows) == 0 {
		_ = svc.RefreshHotelPoolPaid(ctx, p, city, svc.HotelStore, port)
		rows, _ = svc.ListHotelCandidates(ctx, p, city, svc.HotelStore, port)
	}
	_, err = svc.RecruitHotelCandidate(ctx, p, city, svc.HotelStore, port, rows[0].CandidateID)
	if err != ErrHotelCapacityFull {
		t.Fatalf("want capacity reject, got %v", err)
	}
}

type pgHotelCity struct {
	pool *pgxpool.Pool
}

func (p *pgHotelCity) HotelLevel(ctx context.Context, serverID int32, cityID int64) (int32, error) {
	var level int32
	err := p.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(level),0) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=8`,
		serverID, cityID).Scan(&level)
	return level, err
}

func (p *pgHotelCity) OfficeLevel(ctx context.Context, serverID int32, cityID int64) (int32, error) {
	var level int32
	err := p.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(level),0) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=1`,
		serverID, cityID).Scan(&level)
	return level, err
}

func (p *pgHotelCity) SpendGold(ctx context.Context, ref PlayerRef, amount int64) error {
	var gold int64
	err := p.pool.QueryRow(ctx, `
		SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		ref.ServerID, ref.PlayerID).Scan(&gold)
	if err != nil || gold < amount {
		return ErrInsufficientGold
	}
	_, err = p.pool.Exec(ctx, `
		UPDATE player_wallet SET gold=$3 WHERE server_id=$1 AND player_id=$2`,
		ref.ServerID, ref.PlayerID, gold-amount)
	return err
}

func (p *pgHotelCity) SpendItem(ctx context.Context, ref PlayerRef, itemCfgID int32, qty int32) error {
	// PG path uses content service in integration; refresh covered in unit mem test.
	return ErrInsufficientItem
}
