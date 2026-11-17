package march

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var returnPinTables = []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt", "march_order", "field_army", "army_troop"}

func returnSourceFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	_, active, waiting := preparePending(t)
	pool, b, p := completionPG(t, active, waiting)
	body, err := os.ReadFile("../../../spec/db/m4_009_march_identity.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body))
	baseSQL(t, pool, "INSERT INTO field_army(server_id,army_id,owner_player_id,x,y) VALUES(1,1,1,0,0); INSERT INTO army_troop VALUES(1,1,1,7); INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at) VALUES(1,1,1,0,0,1,1,1,now(),now())")
	for _, name := range returnNames {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		p.Objects[name] = v
	}
	return pool, b, p
}

func TestPGReturnSourceProfiles(t *testing.T) {
	_, b, p := returnSourceFixture(t)
	c, first, _ := recruitSourceCatalog(t)
	_, a, ctx := baseOwner(t, b)
	for _, bad := range []*RecruitCatalog{nil, {}, {current: first.Version, manifests: map[string][4]RecruitRule{first.Version: {}}}, {current: "missing", manifests: c.manifests}} {
		if got, err := NewReturnParticipant(ctx, b, a, p, bad); got != nil || !errors.Is(err, ErrReturnSource) {
			t.Fatal("invalid catalog", err)
		}
	}
	for name := range p.Objects {
		for _, mode := range []string{"missing", "extra", "oid", "owner", "duplicate", "renamed"} {
			bad, err := freshsource.Snapshot(p)
			baseOK(t, err)
			v := bad.Objects[name]
			switch mode {
			case "missing":
				delete(bad.Objects, name)
			case "extra":
				bad.Objects["extra"] = v
			case "oid":
				v.OID++
				bad.Objects[name] = v
			case "owner":
				v.OwnerOID++
				bad.Objects[name] = v
			case "duplicate":
				bad.Objects[name] = p.Objects["mil_city_origin"]
				bad.Objects["army_troop"] = p.Objects["mil_city_origin"]
			case "renamed":
				delete(bad.Objects, name)
				bad.Objects["renamed"] = v
			}
			if got, err := NewReturnParticipant(ctx, b, a, bad, c); got != nil || !errors.Is(err, ErrReturnSource) {
				t.Fatalf("accepted %s %s: %v", name, mode, err)
			}
		}
	}
}

func TestPGReturnSourceSnapshotsAndAccess(t *testing.T) {
	pool, b, p := returnSourceFixture(t)
	c, first, second := recruitSourceCatalog(t)
	baseSQL(t, pool, "SELECT setval('work_queue_id_seq',9007199254740991,true)")
	o, a, ctx := baseOwner(t, b)
	snapshot := func() []string {
		var rows []string
		for _, name := range returnPinTables {
			var row string
			baseOK(t, a.Scan(ctx, b, "SELECT COALESCE(jsonb_agg(jsonb_build_array(t,t.xmin::text,t.ctid::text) ORDER BY t.ctid)::text,'') FROM "+pgx.Identifier{p.SchemaName, name}.Sanitize()+" t", nil, &row))
			rows = append(rows, row)
		}
		return rows
	}
	before, seqs := snapshot(), prepareSequences(t, ctx, a, b, p)
	s, err := NewReturnParticipant(ctx, b, a, p, c)
	baseOK(t, err)
	saved, err := freshsource.Snapshot(p)
	baseOK(t, err)
	p.Objects["army_troop"] = p.Objects["work_queue"]
	p.ServerID++
	delete(c.manifests, first.Version)
	*c = RecruitCatalog{}
	if !reflect.DeepEqual(s.source.profile, saved) || s.catalog.current != second.Version || len(s.catalog.manifests) != 2 || s.catalog.manifests[first.Version] != first.Rules {
		t.Fatal("profile/catalog alias")
	}
	copySource, copyAccess := *s, *a
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	if !errors.Is(s.Pin(wctx, wa), recruittx.ErrBinding) {
		t.Fatal("wrong binding")
	}
	baseOK(t, wo.Rollback(wctx))
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if !errors.Is(s.Pin(cancelled, a), context.Canceled) {
		t.Fatal("cancelled access")
	}
	baseOK(t, copySource.Pin(ctx, a))
	if !reflect.DeepEqual(before, snapshot()) || !reflect.DeepEqual(seqs, prepareSequences(t, ctx, a, b, p)) {
		t.Fatal("row or sequence mutation")
	}
	baseOK(t, o.Commit(ctx))
	err = s.Pin(ctx, &copyAccess)
	if !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
		t.Fatal("ended access", err)
	}
	_, a, ctx = baseOwner(t, b)
	baseOK(t, s.Pin(ctx, a))
}

func returnObserveLocks(t *testing.T, ctx context.Context, observer *pgx.Conn, pid int, ids []uint32, want []int32) {
	t.Helper()
	for {
		var got []int32
		baseOK(t, observer.QueryRow(ctx, `SELECT ARRAY(SELECT CASE WHEN l.granted THEN e.n::int ELSE -e.n::int END FROM unnest($2::oid[]) WITH ORDINALITY e(oid,n) JOIN pg_catalog.pg_locks l ON l.relation=e.oid WHERE l.pid=$1 AND l.mode='RowExclusiveLock' ORDER BY e.n)`, pid, ids).Scan(&got))
		if reflect.DeepEqual(got, want) {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("pin witness: got %v want %v: %v", got, want, ctx.Err())
		case <-time.After(10 * time.Millisecond):
		}
	}
}

func TestPGReturnSourceOrderedPins(t *testing.T) {
	for _, drift := range []string{"clean", "old14", "new9", "cancel"} {
		t.Run(drift, func(t *testing.T) {
			pool, b, p := returnSourceFixture(t)
			c, _, _ := recruitSourceCatalog(t)
			o, a, ctx := baseOwner(t, b)
			s, err := NewReturnParticipant(ctx, b, a, p, c)
			baseOK(t, err)
			copySource := *s
			baseOK(t, o.Rollback(ctx)) // Constructor catalog reads must not mask Pin order.
			o, a, ctx = baseOwner(t, b)
			connect := func() *pgx.Conn {
				conn, err := pgx.ConnectConfig(ctx, pool.Config().ConnConfig.Copy())
				baseOK(t, err)
				t.Cleanup(func() {
					clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
					defer stop()
					_ = conn.Close(clean)
				})
				return conn
			}
			observer := connect()
			var pid int
			baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
			var ids []uint32
			var tables []string
			var blockers []*pgx.Conn
			for _, name := range returnPinTables {
				ids, tables = append(ids, p.Objects[name].OID), append(tables, pgx.Identifier{p.SchemaName, name}.Sanitize())
				conn := connect()
				_, err := conn.Exec(ctx, "BEGIN; LOCK TABLE ONLY "+tables[len(tables)-1]+" IN ACCESS EXCLUSIVE MODE")
				baseOK(t, err)
				blockers = append(blockers, conn)
			}
			done := make(chan error, 1)
			finished := make(chan struct{})
			pinCtx, stopPin := context.WithCancel(ctx)
			go func() { defer close(finished); done <- s.Pin(pinCtx, a) }()
			// On any assertion failure, cancel and join before connection/fixture cleanup.
			t.Cleanup(func() {
				stopPin()
				select {
				case <-finished:
				case <-time.After(5 * time.Second):
					t.Error("Pin goroutine did not stop")
				}
			})
			var want []int32
			for i, blocker := range blockers {
				returnObserveLocks(t, ctx, observer, pid, ids, append(want, -int32(i+1)))
				if drift == "cancel" {
					stopPin()
					break
				}
				if i == 7 && drift != "clean" {
					ddl := "ALTER TABLE army_troop ENABLE ROW LEVEL SECURITY"
					if drift == "old14" {
						ddl = "ALTER SEQUENCE work_queue_id_seq CACHE 2"
					}
					_, err := blocker.Exec(ctx, ddl)
					baseOK(t, err)
				}
				_, err := blocker.Exec(ctx, "COMMIT")
				baseOK(t, err)
				want = append(want, int32(i+1))
			}
			select {
			case err = <-done:
			case <-ctx.Done():
				t.Fatal("Pin did not complete", ctx.Err())
			}
			if drift == "cancel" {
				if !errors.Is(err, context.Canceled) || s.source.retired.Load() {
					t.Fatal("blocked cancellation poisoned source", err)
				}
				for _, blocker := range blockers {
					_, err := blocker.Exec(ctx, "ROLLBACK")
					baseOK(t, err)
				}
				_ = o.Rollback(ctx) // pgx may already have closed its canceled connection.
				_, next, nextCtx := baseOwner(t, b)
				baseOK(t, copySource.Pin(nextCtx, next))
				return
			}
			if drift == "clean" && err != nil || drift != "clean" && !errors.Is(err, ErrReturnSource) {
				t.Fatal("missing post-eighth-pin revalidation", err)
			}
			if drift == "old14" && !errors.Is(err, ErrFreshCitySource) || drift == "new9" && !errors.Is(err, errReturnCatalog) {
				t.Fatal("source drift cause lost", err)
			}
			returnObserveLocks(t, ctx, observer, pid, ids, want)
			_, err = observer.Exec(ctx, "BEGIN; SELECT 1 FROM "+strings.Join(tables, " FOR UPDATE NOWAIT; SELECT 1 FROM ")+" FOR UPDATE NOWAIT; ROLLBACK")
			baseOK(t, err) // Every seeded row remains independently lockable.
			q := "BEGIN; LOCK TABLE " + strings.Join(tables, ",") + " IN ACCESS EXCLUSIVE MODE NOWAIT"
			_, err = observer.Exec(ctx, q)
			var pg *pgconn.PgError
			if !errors.As(err, &pg) || pg.Code != "55P03" {
				t.Fatal("pins not retained until caller end", err)
			}
			_, err = observer.Exec(ctx, "ROLLBACK")
			baseOK(t, err)
			baseOK(t, o.Rollback(ctx))
			_, err = observer.Exec(ctx, q+"; ROLLBACK")
			baseOK(t, err)
			if drift != "clean" {
				baseSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq CACHE 1; ALTER TABLE army_troop DISABLE ROW LEVEL SECURITY")
				_, a, ctx = baseOwner(t, b)
				if !errors.Is(copySource.Pin(ctx, a), ErrReturnSource) || !s.source.retired.Load() {
					t.Fatal("repair resurrected copied source")
				}
			}
		})
	}
}
