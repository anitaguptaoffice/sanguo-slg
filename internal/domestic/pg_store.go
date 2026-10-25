package domestic

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const queueTypeBuild int16 = 1

// PGStore persists domestic state (spec/db/003_domestic.sql).
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a pool.
func NewPGStore(p *pgxpool.Pool) *PGStore { return &PGStore{Pool: p} }

type buildPayload struct {
	Slot   string `json:"slot"`
	CfgID  int32  `json:"cfg_id"`
	Target int32  `json:"target"`
}

// SaveCity writes wallet snapshot, buildings, and pending build queue rows.
func (p *PGStore) SaveCity(ctx context.Context, sid int32, c *CityState, cat map[int32]BuildingSpec, now time.Time) error {
	return p.saveCity(ctx, sid, c, cat, now, nil)
}

// saveCity holds the authoritative wallet row lock through the local operation.
func (p *PGStore) saveCity(ctx context.Context, sid int32, c *CityState, cat map[int32]BuildingSpec, now time.Time, mutate func(*CityState) error) error {
	if c == nil || c.PlayerID == 0 {
		return errors.New("domestic: city missing player_id")
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	work := cloneCity(c)
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold,updated_at)
 VALUES ($1,$2,$3,$4,$5,$6,0,$7) ON CONFLICT DO NOTHING`, sid, c.PlayerID, c.Wallet.Food, c.Wallet.Wood, c.Wallet.Iron, c.Wallet.Stone, now)
	if err != nil {
		return err
	}
	var authoritative Resources
	err = tx.QueryRow(ctx, `SELECT food,wood,stone,iron FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, sid, c.PlayerID).Scan(&authoritative.Food, &authoritative.Wood, &authoritative.Stone, &authoritative.Iron)
	if err != nil {
		return err
	}
	if c.walletSaved {
		authoritative, err = reconcileWallet(authoritative, c.Wallet, c.walletBase)
		if err != nil {
			return err
		}
	}
	work.Wallet = authoritative
	if mutate != nil {
		if err = mutate(work); err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE player_wallet SET food=$3,wood=$4,stone=$5,iron=$6,updated_at=$7 WHERE server_id=$1 AND player_id=$2`, sid, c.PlayerID, work.Wallet.Food, work.Wallet.Wood, work.Wallet.Stone, work.Wallet.Iron, work.LastSettleAt)
	if err != nil {
		return err
	}
	original := c
	c = work

	_, err = tx.Exec(ctx, `DELETE FROM city_building WHERE server_id=$1 AND city_id=$2`, sid, c.ID)
	if err != nil {
		return err
	}
	finishBySlot := activeFinishBySlot(c)
	for slot, inst := range c.Buildings {
		var finish *time.Time
		if t, ok := finishBySlot[slot]; ok {
			finish = &t
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO city_building (server_id, city_id, slot_key, building_cfg_id, level, upgrade_finish_at)
			VALUES ($1,$2,$3,$4,$5,$6)`,
			sid, c.ID, slot, inst.CfgID, inst.Level, finish)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `
		DELETE FROM work_queue
		WHERE server_id=$1 AND city_id=$2 AND queue_type=$3 AND status IN (0,1)`,
		sid, c.ID, queueTypeBuild)
	if err != nil {
		return err
	}
	for _, job := range c.BuildJobs {
		if job.Status != QueueWaiting && job.Status != QueueActive {
			continue
		}
		pl, err := json.Marshal(buildPayload{Slot: job.Slot, CfgID: job.CfgID, Target: job.Target})
		if err != nil {
			return err
		}
		start := jobStartAt(cat, job)
		_, err = tx.Exec(ctx, `
			INSERT INTO work_queue (
				server_id, queue_id, player_id, city_id, queue_type, payload, start_at, finish_at, status
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			sid, job.ID, c.PlayerID, c.ID, queueTypeBuild, pl, start, job.FinishAt, int16(job.Status))
		if err != nil {
			return err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return err
	}
	c.walletBase, c.walletSaved = c.Wallet, true
	*original = *c
	return nil
}

// LoadCity restores wallet, buildings, and build queue for one city.
func (p *PGStore) LoadCity(ctx context.Context, sid int32, cityID, playerID int64) (*CityState, error) {
	var w Resources
	var updated time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT food, wood, iron, stone, updated_at FROM player_wallet
		WHERE server_id=$1 AND player_id=$2`, sid, playerID).
		Scan(&w.Food, &w.Wood, &w.Iron, &w.Stone, &updated)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		updated = time.Time{}
	}

	c := &CityState{
		ID: cityID, PlayerID: playerID, Wallet: w, LastSettleAt: updated,
		Buildings: make(map[string]*BuildingInstance),
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT slot_key, building_cfg_id, level FROM city_building
		WHERE server_id=$1 AND city_id=$2`, sid, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var slot string
		var inst BuildingInstance
		if err := rows.Scan(&slot, &inst.CfgID, &inst.Level); err != nil {
			return nil, err
		}
		c.Buildings[slot] = &inst
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	qrows, err := p.Pool.Query(ctx, `
		SELECT queue_id, payload, start_at, finish_at, status FROM work_queue
		WHERE server_id=$1 AND city_id=$2 AND queue_type=$3 AND status IN (0,1)
		ORDER BY finish_at`, sid, cityID, queueTypeBuild)
	if err != nil {
		return nil, err
	}
	defer qrows.Close()
	var maxID int64
	for qrows.Next() {
		var id int64
		var raw []byte
		var start, finish time.Time
		var st int16
		if err := qrows.Scan(&id, &raw, &start, &finish, &st); err != nil {
			return nil, err
		}
		var pl buildPayload
		if err := json.Unmarshal(raw, &pl); err != nil {
			return nil, err
		}
		c.BuildJobs = append(c.BuildJobs, &BuildJob{
			ID: id, Slot: pl.Slot, CfgID: pl.CfgID, Target: pl.Target,
			Status: QueueStatus(st), FinishAt: finish,
		})
		if id > maxID {
			maxID = id
		}
	}
	if err := qrows.Err(); err != nil {
		return nil, err
	}
	c.walletBase, c.walletSaved = c.Wallet, true
	c.nextJobID = maxID
	return c, nil
}

func activeFinishBySlot(c *CityState) map[string]time.Time {
	out := make(map[string]time.Time)
	for _, j := range c.BuildJobs {
		if j.Status == QueueActive {
			out[j.Slot] = j.FinishAt
		}
	}
	return out
}

func jobStartAt(cat map[int32]BuildingSpec, job *BuildJob) time.Time {
	sp, ok := cat[job.CfgID]
	if !ok {
		return job.FinishAt
	}
	dur := upDur(sp, job.Target)
	start := job.FinishAt.Add(-dur)
	if start.After(job.FinishAt) {
		return job.FinishAt
	}
	return start
}

// Both snapshots are nonnegative; reject overflow and concurrent overspend.
func reconcileWallet(current, local, base Resources) (Resources, error) {
	a, b, d := []*int64{&current.Food, &current.Wood, &current.Stone, &current.Iron}, []int64{local.Food, local.Wood, local.Stone, local.Iron}, []int64{base.Food, base.Wood, base.Stone, base.Iron}
	for i, v := range a {
		if b[i] < 0 || d[i] < 0 || *v < 0 {
			return Resources{}, ErrInsufficientRes
		}
		delta := b[i] - d[i]
		if (delta > 0 && *v > math.MaxInt64-delta) || (delta < 0 && *v < -delta) {
			return Resources{}, ErrInsufficientRes
		}
		*v += delta
	}
	return current, nil
}
