package march

import (
	"context"
	"errors"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMarchRestoreRetainedAnchor(t *testing.T) {
	for _, phase := range []string{"live", "terminal"} {
		for _, fault := range []string{"missing", "zero", "negative"} {
			t.Run(phase+"/"+fault, func(t *testing.T) {
				in := restoreSample()
				if phase == "terminal" {
					in.orders[0].Status = 4
				}
				switch fault {
				case "missing":
					in.orders[0].Owner, in.orders[0].ArmyStatus = nil, nil
				case "zero":
					in.orders[0].Owner = restorePtr(int64(0))
				case "negative":
					in.orders[0].Owner = restorePtr(int64(-1))
				}
				res, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, 0)
				if !errors.Is(err, ErrMarchRestore) || !reflect.DeepEqual(res, RestoreResult{}) || items != nil || stacks != nil {
					t.Fatalf("invalid ownership published: result=%+v items=%v stacks=%v err=%v", res, items, stacks, err)
				}
			})
		}
	}
	for _, reuse := range []bool{false, true} {
		name := "terminal released"
		if reuse {
			name = "terminal hero reused"
		}
		t.Run(name, func(t *testing.T) {
			in := restoreSample()
			in.orders[0].Status, in.orders[0].ArmyStatus = 4, restorePtr(int64(1))
			// Annihilated terminal history needs neither troops nor a return deadline.
			in.troops = in.troops[1:]
			if reuse {
				in.orders[1].Heroes = append(in.orders[1].Heroes, 11)
				in.heroes[0].Player = 8
			}
			res, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, 0)
			baseOK(t, err)
			want := []HeroRelease{{1, 7, 11}, {1, 7, 12}, {1, 7, 13}}
			if reuse {
				want = want[1:]
			}
			if len(res.Marches) != 1 || res.Marches[0].MarchID != 30 || !reflect.DeepEqual(res.Release, want) {
				t.Fatalf("terminal replay or wrong release: %+v", res)
			}
			h := NewHub(time.Now)
			baseOK(t, installRestore(h, items, stacks))
			baseOK(t, h.ActivateRestore())
			if len(h.marches) != 1 || h.March(10) != nil || len(h.scheduler.events) != 1 || h.scheduler.events[0].ev.RefID != 30 {
				t.Fatal("terminal history scheduled")
			}
		})
	}
}

func TestPGMarchRestoreRetainedAnchor(t *testing.T) {
	for _, tc := range []struct {
		name, change, repair string
		release              []HeroRelease
	}{
		{"missing", `DELETE FROM field_army WHERE server_id=1 AND army_id=504`, `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES(1,504,70,1,1,1,'{16}')`, nil},
		{"other shard", `UPDATE field_army SET server_id=2 WHERE server_id=1 AND army_id=504`, `UPDATE field_army SET server_id=1 WHERE server_id=2 AND army_id=504`, nil},
		{"zero owner", `UPDATE field_army SET owner_player_id=0 WHERE army_id=504`, `UPDATE field_army SET owner_player_id=70 WHERE army_id=504`, nil},
		{"negative owner", `UPDATE field_army SET owner_player_id=-1 WHERE army_id=504`, `UPDATE field_army SET owner_player_id=70 WHERE army_id=504`, nil},
		{"retained survivors", "", "", []HeroRelease{{1, 70, 16}, {1, 70, 17}}},
		{"annihilated", `DELETE FROM army_troop WHERE army_id=504; UPDATE march_order SET return_finish_at=NULL WHERE march_id=504`, "", []HeroRelease{{1, 70, 16}, {1, 70, 17}}},
		{"already idle", `UPDATE player_hero SET status=1 WHERE hero_id=16`, "", []HeroRelease{{1, 70, 17}}},
		{"reused by live army", `UPDATE field_army SET hero_ids='{11,16}' WHERE army_id=500`, "", []HeroRelease{{1, 70, 17}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, _, p, _ := marchStoreFixture(t)
			baseSQL(t, pool, restoreSeedSQL)
			mutate := func(sql string) {
				if sql == "" {
					return
				}
				tag, err := pool.Exec(context.Background(), sql)
				baseOK(t, err)
				if tag.RowsAffected() != 1 {
					t.Fatalf("fixture change affected %d rows", tag.RowsAffected())
				}
			}
			mutate(tc.change)
			cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
			baseOK(t, err)
			cfg.ConnConfig.RuntimeParams["search_path"] = "pg_catalog"
			fresh, err := pgxpool.NewWithConfig(context.Background(), cfg)
			baseOK(t, err)
			t.Cleanup(fresh.Close)
			var writerPID, readerPID int32
			baseOK(t, pool.QueryRow(context.Background(), `SELECT pg_backend_pid()`).Scan(&writerPID))
			baseOK(t, fresh.QueryRow(context.Background(), `SELECT pg_backend_pid()`).Scan(&readerPID))
			if writerPID == readerPID {
				t.Fatal("restore did not use a separate database connection")
			}
			r, err := NewMarchRestore(context.Background(), fresh, p)
			baseOK(t, err)
			h := NewHub(time.Now)
			read := func() (RestoreResult, error) {
				before, seq := restoreSourceSnap(t, fresh, p.SchemaName), marchStoreSeq(t, fresh, p)
				res, err := r.Restore(context.Background(), h)
				if restoreSourceSnap(t, fresh, p.SchemaName) != before || marchStoreSeq(t, fresh, p) != seq {
					t.Fatal("restore changed durable rows or sequences")
				}
				return res, err
			}
			res, err := read()
			want := tc.release
			if tc.repair != "" {
				if !errors.Is(err, ErrMarchRestore) || !reflect.DeepEqual(res, RestoreResult{}) || h.restored || h.restoreEv != nil ||
					len(h.marches)+len(h.marchCtx)+len(h.scheduler.events) != 0 || h.nextMarch != 0 {
					t.Fatalf("invalid terminal anchor accepted/published: result=%+v err=%v", res, err)
				}
				if !errors.Is(h.ActivateRestore(), ErrMarchRestore) {
					t.Fatal("rejected snapshot activated")
				}
				mutate(tc.repair) // Test-owned repair, never a production repair path.
				res, err = read() // The same untouched Hub can accept a fresh valid snapshot.
				want = []HeroRelease{{1, 70, 16}, {1, 70, 17}}
			}
			baseOK(t, err)
			if len(res.Marches) != 4 || !reflect.DeepEqual(res.Release, want) || !h.restored || h.nextMarch != 503 ||
				len(h.marches) != 4 || len(h.marchCtx) != 4 || len(h.restoreEv) != 4 || len(h.scheduler.events) != 0 || h.March(504) != nil {
				t.Fatalf("valid terminal history replayed or wrong release: %+v", res)
			}
			for _, binding := range res.Marches {
				if binding.MarchID == 504 {
					t.Fatal("terminal binding returned")
				}
			}
			baseOK(t, h.ActivateRestore())
			if len(h.scheduler.events) != 4 {
				t.Fatal("wrong activated event count")
			}
			for _, event := range h.scheduler.events {
				if event.ev.RefID == 504 {
					t.Fatal("terminal event scheduled")
				}
			}
			t.Logf("retained-anchor %s: independent PG read, no durable writes, terminal not replayed", tc.name)
		})
	}
}
