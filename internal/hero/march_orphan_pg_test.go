package hero

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGReleaseMarchOrphan(t *testing.T) {
	t.Setenv("SANGUO_PG_REUSE_SPEC", "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	check := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	var schema string
	check(pool.QueryRow(ctx, "SELECT current_schema()").Scan(&schema))
	store := NewPGStore(pool)
	check(store.ensureMarchForceTable(ctx))
	_, err := pool.Exec(ctx, `
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status,loyalty)
		VALUES (1,11,20,11,3,81),(1,12,20,12,3,81),(1,13,20,13,3,81),
			(1,14,20,14,3,81),(1,15,20,15,1,81),(1,16,20,16,3,81),
			(1,17,20,17,3,81),(1,18,20,18,3,81),(1,19,20,19,3,81);
		INSERT INTO hero_march_force(server_id,hero_id,current_force,last_regen_at)
		VALUES(1,11,21,'2020-01-01');
		INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids)
		VALUES (1,12,20,2,1,1,'{12}'),(1,13,20,3,1,1,'{13}'),(1,14,20,1,1,1,'{14}'),
			(1,16,21,2,1,1,'{16}'),(1,17,20,3,1,1,'{17}'),(1,18,20,1,1,1,'{18}');
		INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id)
		SELECT 1, batch.id, batch.id, 1, 1, 2, 2, 1, '2020-01-01', '2020-01-02', batch.state, 99
		FROM (VALUES (12,1),(13,3),(14,4),(16,1),(18,2)) AS batch(id,state);
		CREATE SEQUENCE orphan_retry_count; CREATE SEQUENCE orphan_concurrent_count;
		CREATE FUNCTION count_orphan_update() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
		  IF NEW.hero_id=11 AND nextval('orphan_retry_count')=1
		  THEN RAISE EXCEPTION 'fixture retry'; END IF;
		  IF NEW.hero_id=19 THEN PERFORM nextval('orphan_concurrent_count'); END IF;
		  RETURN NEW;
		END $$;
		CREATE TRIGGER count_orphan_update BEFORE UPDATE ON player_hero FOR EACH ROW EXECUTE FUNCTION count_orphan_update();
	`)
	check(err)
	svc := NewService()
	svc.UseStore(store)
	actor := PlayerRef{ServerID: 1, PlayerID: 20}
	for _, id := range []int64{12, 13, 16, 17, 18} {
		if err := svc.ReleaseMarchOrphan(ctx, schema, actor, id); !errors.Is(err, ErrMarchOrphanLinked) {
			t.Fatalf("linked hero %d: %v", id, err)
		}
	}
	if err := svc.ReleaseMarchOrphan(ctx, schema, PlayerRef{ServerID: 1, PlayerID: 21}, 11); !errors.Is(err, ErrHeroNotFound) {
		t.Fatalf("foreign hero: %v", err)
	}
	for _, id := range []int64{11, 11, 14, 15} {
		check(svc.ReleaseMarchOrphan(ctx, schema, actor, id))
	}
	start, done := make(chan struct{}), make(chan error, 2)
	for range 2 {
		go func() {
			<-start
			done <- svc.ReleaseMarchOrphan(ctx, schema, actor, 19)
		}()
	}
	close(start)
	check(<-done)
	check(<-done)
	observer, err := pool.Acquire(ctx)
	check(err)
	defer observer.Release()
	var status string
	var loyalty, force, attempts int32
	var once bool
	check(observer.QueryRow(ctx, `SELECT string_agg(status::text,'' ORDER BY hero_id), min(loyalty),
		(SELECT current_force FROM hero_march_force WHERE server_id=1 AND hero_id=11),
		(SELECT last_value FROM orphan_retry_count),
		(SELECT is_called AND last_value=1 FROM orphan_concurrent_count) FROM player_hero`).Scan(&status, &loyalty, &force, &attempts, &once))
	if status != "133113331" || loyalty != 81 || force != 21 || attempts != 2 || !once {
		t.Fatalf("statuses=%s loyalty=%d force=%d retry=%d one concurrent write=%t", status, loyalty, force, attempts, once)
	}
}
