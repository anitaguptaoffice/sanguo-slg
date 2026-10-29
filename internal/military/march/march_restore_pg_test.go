package march

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// restoreSourceSnap hashes every source table with xmin/ctid, so even a
// committed value-preserving UPDATE is visible to the read-only evidence.
func restoreSourceSnap(t *testing.T, pool *pgxpool.Pool, schema string) string {
	t.Helper()
	var parts []string
	for _, name := range []string{"march_order", "field_army", "army_troop", "battle_report", "player_hero"} {
		table := pgx.Identifier{schema, name}.Sanitize()
		var part string
		baseOK(t, pool.QueryRow(context.Background(), `SELECT COALESCE(md5(string_agg(xmin::text||'/'||ctid::text||'/'||row_to_json(rowsrc)::text,'|' ORDER BY xmin::text||ctid::text)),'') FROM `+table+` rowsrc`).Scan(&part))
		parts = append(parts, name+"="+part)
	}
	return strings.Join(parts, ";")
}

const restoreSeedSQL = `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES(1,500,70,2,1,1,'{11}'),(1,501,70,2,1,1,'{12,13}'),(1,502,70,3,1,1,'{14}'),(1,503,70,3,1,1,'{15}'),(1,504,70,1,1,1,'{16}');INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id,return_finish_at) VALUES(1,500,500,1,1,2,2,1,now()-interval '10 min',now()+interval '2 hours',1,100,NULL),(1,501,501,1,1,2,2,1,now()-interval '2 hours',now()-interval '1 hour',1,100,NULL),(1,502,502,1,1,2,2,1,now()-interval '3 hours',now()-interval '2 hours',3,100,now()+interval '1 hour'),(1,503,503,1,1,2,2,1,now()-interval '4 hours',now()-interval '3 hours',3,100,now()-interval '30 min'),(1,504,504,1,1,2,2,1,now()-interval '5 hours',now()-interval '4 hours',4,100,now()-interval '2 hours');INSERT INTO army_troop VALUES(1,500,1,5),(1,501,2,3),(1,502,1,2),(1,502,2,4),(1,503,3,1),(1,504,1,1);INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,70,11,3),(1,12,70,12,3),(1,13,70,13,3),(1,14,70,14,3),(1,15,70,15,3),(1,16,70,16,3),(1,17,70,17,3),(1,18,70,18,1);`

func TestPGMarchRestore(t *testing.T) {
	pool, _, p, _ := marchStoreFixture(t)
	baseSQL(t, pool, restoreSeedSQL)
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	baseOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{p.SchemaName}.Sanitize()
	ipool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	baseOK(t, err)
	t.Cleanup(ipool.Close)
	before, seq := restoreSourceSnap(t, ipool, p.SchemaName), marchStoreSeq(t, ipool, p)
	r, err := NewMarchRestore(context.Background(), pool, p)
	baseOK(t, err)
	now := time.Now()
	h := NewHub(func() time.Time { return now })
	res, err := r.Restore(context.Background(), h)
	baseOK(t, err)
	if len(res.Marches) != 4 || len(res.Release) != 2 || res.Release[0].HeroID != 16 || res.Release[1].HeroID != 17 ||
		res.Marches[1].HeroIDs[1] != 13 || h.nextMarch != 503 || len(h.marches) != 4 || len(h.marchCtx) != 4 ||
		h.marches[500].Phase != PhaseMarching || h.marches[501].Phase != PhaseMarching || h.marches[502].Phase != PhaseReturning ||
		h.marches[503].Phase != PhaseReturning || h.marches[502].Speed != 50 || h.marchCtx[500].HeroID != 11 ||
		h.marchCtx[501].HeroID != 0 || h.marchCtx[503].OriginCityID != 100 || h.marchCtx[501].Troops[0] != (TroopStack{2, 3}) ||
		len(h.scheduler.events) != 0 || len(h.restoreEv) != 4 {
		t.Fatalf("restored %#v hub=%d", res, h.nextMarch)
	}
	baseOK(t, h.ActivateRestore())
	if len(h.scheduler.events) != 4 || h.scheduler.NextDue().After(now) {
		t.Fatalf("activated %d events", len(h.scheduler.events))
	}
	h.cities[100] = &CityState{ID: 100, PlayerID: 70, Troops: map[int32]int32{3: 1}}
	if n := h.scheduler.PollDue(now); n != 2 || h.marches[501].Phase != PhaseArrived || h.marches[503].Phase != PhaseReturned ||
		h.scheduler.NextDue().Before(now) || restoreSourceSnap(t, ipool, p.SchemaName) != before || marchStoreSeq(t, ipool, p) != seq {
		t.Fatalf("poll=%d", n)
	}
	for name, tc := range map[string]struct{ sql, undo string }{
		"status 2":              {`UPDATE march_order SET status=2,return_finish_at=now()+interval '1 hour' WHERE march_id=500`, `UPDATE march_order SET status=1,return_finish_at=NULL WHERE march_id=500`},
		"origin null":           {`UPDATE march_order SET origin_city_id=NULL WHERE march_id=500`, `UPDATE march_order SET origin_city_id=100 WHERE march_id=500`},
		"army missing":          {`DELETE FROM field_army WHERE army_id=500`, `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES(1,500,70,2,1,1,'{11}')`},
		"army without march":    {`INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,505,70,2,1,1)`, `DELETE FROM field_army WHERE army_id=505`},
		"no troops":             {`DELETE FROM army_troop WHERE army_id=500`, `INSERT INTO army_troop VALUES(1,500,1,5)`},
		"duplicate live army":   {`INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id) VALUES(1,505,500,1,1,2,2,1,now(),now()+interval '1 hour',1,100)`, `DELETE FROM march_order WHERE march_id=505`},
		"duplicate troop unit":  {`ALTER TABLE army_troop DROP CONSTRAINT army_troop_pkey; INSERT INTO army_troop VALUES(1,500,1,1)`, `DELETE FROM army_troop WHERE army_id=500 AND unit_cfg_id=1 AND count=1; ALTER TABLE army_troop ADD PRIMARY KEY(server_id,army_id,unit_cfg_id)`},
		"unknown unit":          {`UPDATE army_troop SET unit_cfg_id=99 WHERE army_id=500`, `UPDATE army_troop SET unit_cfg_id=1 WHERE army_id=500`},
		"empty heroes":          {`UPDATE field_army SET hero_ids='{}' WHERE army_id=500`, `UPDATE field_army SET hero_ids='{11}' WHERE army_id=500`},
		"duplicate hero":        {`UPDATE field_army SET hero_ids='{11,11}' WHERE army_id=500`, `UPDATE field_army SET hero_ids='{11}' WHERE army_id=500`},
		"hero in two armies":    {`UPDATE field_army SET hero_ids='{11}' WHERE army_id=501`, `UPDATE field_army SET hero_ids='{12,13}' WHERE army_id=501`},
		"unknown hero":          {`UPDATE field_army SET hero_ids='{99}' WHERE army_id=500`, `UPDATE field_army SET hero_ids='{11}' WHERE army_id=500`},
		"hero other owner":      {`UPDATE player_hero SET player_id=71 WHERE hero_id=11`, `UPDATE player_hero SET player_id=70 WHERE hero_id=11`},
		"hero not claiming":     {`UPDATE player_hero SET status=1 WHERE hero_id=11`, `UPDATE player_hero SET status=3 WHERE hero_id=11`},
		"marching deadline":     {`UPDATE march_order SET return_finish_at=now() WHERE march_id=500`, `UPDATE march_order SET return_finish_at=NULL WHERE march_id=500`},
		"returning no deadline": {`UPDATE march_order SET return_finish_at=NULL WHERE march_id=502`, `UPDATE march_order SET return_finish_at=now()+interval '1 hour' WHERE march_id=502`},
	} {
		t.Run(name, func(t *testing.T) {
			baseSQL(t, pool, tc.sql)
			defer baseSQL(t, pool, tc.undo)
			failing, bad := restoreSourceSnap(t, ipool, p.SchemaName), NewHub(time.Now)
			if _, err := r.Restore(context.Background(), bad); !errors.Is(err, ErrMarchRestore) || len(bad.marches)+len(bad.marchCtx) != 0 ||
				bad.nextMarch != 0 || len(bad.scheduler.events) != 0 || len(bad.restoreEv) != 0 || restoreSourceSnap(t, ipool, p.SchemaName) != failing {
				t.Fatalf("accepted or wrote: %v", err)
			}
		})
	}
}

func TestPGMarchRestoreEmptyOnce(t *testing.T) {
	pool, _, p, _ := marchStoreFixture(t)
	r, err := NewMarchRestore(context.Background(), pool, p)
	baseOK(t, err)
	h := NewHub(time.Now)
	res, err := r.Restore(context.Background(), h)
	if err != nil || len(res.Marches) != 0 || len(res.Release) != 0 || len(h.marches) != 0 {
		t.Fatalf("empty restore %#v %v", res, err)
	}
	if _, err := r.Restore(context.Background(), h); !errors.Is(err, ErrMarchRestore) {
		t.Fatalf("empty restore repeated: %v", err)
	}
	baseOK(t, h.ActivateRestore())
}

func TestPGRestoreSnapDetectsNoopWrite(t *testing.T) {
	pool, _, p, _ := marchStoreFixture(t)
	baseSQL(t, pool, restoreSeedSQL)
	before := restoreSourceSnap(t, pool, p.SchemaName)
	baseSQL(t, pool, `UPDATE `+pgx.Identifier{p.SchemaName, "field_army"}.Sanitize()+` SET status=status WHERE army_id=500`)
	if after := restoreSourceSnap(t, pool, p.SchemaName); after == before {
		t.Fatal("value-preserving write invisible to the snapshot")
	}
}
