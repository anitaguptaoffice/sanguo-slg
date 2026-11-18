package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type preparedMarchAckTrace struct {
	returnPGTrace
	network *returnNetwork
}

func (r *preparedMarchAckTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if preparedMarchOrderInsert(data.SQL) {
		r.network.armed.Store(true)
	}
	return r.returnPGTrace.TraceQueryStart(ctx, conn, data)
}

func preparedMarchOrderInsert(sql string) bool {
	return strings.HasPrefix(sql, "INSERT INTO ") && strings.Contains(sql, `."march_order"(server_id,march_id,`)
}

func TestPGPreparedMarchCreateLostCommitAcknowledgement(t *testing.T) {
	n := &returnNetwork{reached: make(chan returnNetworkWitness, 1), resume: make(chan struct{})}
	trace := &preparedMarchAckTrace{network: n}
	f := newPreparedMarchPG(t, trace, n.configure)
	var cancel, stop context.CancelFunc
	n.ctx, cancel = context.WithTimeout(f.ctx, 10*time.Second)
	n.guard, stop = context.WithTimeout(f.ctx, 8*time.Second)
	done := make(chan struct{})
	t.Cleanup(func() {
		cancel()
		stop()
		n.abort()
		select {
		case <-done:
		case <-time.After(6 * time.Second):
			t.Error("prepared march caller did not exit")
		}
	})
	var reply *commonv1.ServerPacket
	var callErr error
	go func() {
		defer close(done)
		reply, callErr = f.request(n.ctx, "owner", 4, 1)
	}()
	var witness returnNetworkWitness
	select {
	case witness = <-n.reached:
	case <-n.guard.Done():
		t.Fatal("prepared create COMMIT was not intercepted")
	}
	if witness.err != errReturnNetwork || !witness.forwarded || !witness.tag || !witness.idle ||
		witness.withheld != 18 || witness.pid == 0 || witness.pid == f.observer.PgConn().PID() {
		t.Fatalf("unexpected acknowledgement evidence: %+v", witness)
	}
	forceAfter := f.maxForce - hero.MarchForceMarchCost
	if ready, orders, status, force := f.stock(); ready != 7 || orders != 1 || status != hero.StatusMarch || force != forceAfter {
		t.Fatal("observer did not see exactly one durable debit and order", ready, orders, status, force)
	}
	var origin, player, armyID, heroID int64
	var deployed int32
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT o.origin_city_id,a.owner_player_id,a.army_id,a.hero_ids[1],t.count
		FROM march_order o JOIN field_army a USING(server_id,army_id) JOIN army_troop t USING(server_id,army_id)
		WHERE o.march_id=1 AND t.unit_cfg_id=1`).Scan(&origin, &player, &armyID, &heroID, &deployed))
	if origin != 1 || player != 1 || armyID != 1 || heroID != 11 || deployed != 4 {
		t.Fatal("observer read the wrong durable march graph", origin, player, armyID, heroID, deployed)
	}
	recruitLifetimeState(t, f.g, 1, false, true)
	select {
	case <-done:
		t.Fatal("caller completed before acknowledgement was released")
	default:
	}
	n.release()
	select {
	case <-done:
	case <-n.guard.Done():
		t.Fatal("prepared create did not return after its connection closed")
	}
	returnPGOK(t, callErr)
	assertPreparedMarchUnavailable(t, reply)
	n.ended(t, &returnAttemptPG{observer: f.observer, profile: f.profile}, witness.pid)
	n.armed.Store(false)
	recruitLifetimeState(t, f.g, 1, true, false)
	if f.s.military.March(1) != nil {
		t.Fatal("unacknowledged order was published")
	}
	count := len(trace.events())
	retry, err := f.request(f.ctx, "owner", 4, 1)
	returnPGOK(t, err)
	assertPreparedMarchUnavailable(t, retry)
	if len(trace.events()) != count {
		t.Fatal("fenced retry touched the database")
	}
	fresh := march.NewHub(nil)
	restored, err := f.restore.Restore(f.ctx, fresh)
	returnPGOK(t, err)
	if len(restored.Marches) != 1 || len(restored.Release) != 0 || restored.Marches[0].MarchID != 1 || fresh.March(1).ArmyID != armyID {
		t.Fatal("new Hub did not restore the existing order", restored)
	}
	if ready, orders, status, force := f.stock(); ready != 7 || orders != 1 || status != hero.StatusMarch || force != forceAfter {
		t.Fatal("restart or retry repeated effects or released the linked hero", ready, orders, status, force)
	}
}

func assertPreparedMarchUnavailable(t *testing.T, reply *commonv1.ServerPacket) {
	t.Helper()
	if reply.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || len(reply.GetData()) != 0 {
		t.Fatal("expected unavailable for unconfirmed create", reply)
	}
}

type preparedMarchRollbackTrace struct {
	returnPGTrace
	armed, bounded bool
	pid            uint32
	fault          error
}

func (r *preparedMarchRollbackTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if preparedMarchOrderInsert(data.SQL) {
		r.armed = true
	}
	if r.armed && data.SQL == "rollback" {
		deadline, ok := ctx.Deadline()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
		r.pid = conn.PgConn().PID()
		panic(r.fault)
	}
	return r.returnPGTrace.TraceQueryStart(ctx, conn, data)
}

const marchRollbackChild = "SANGUO_MARCH_CREATE_ROLLBACK_CHILD"
const marchRollbackSchema = "MARCH_CREATE_ROLLBACK_SCHEMA "
const marchRollbackPassed = "MARCH_CREATE_ROLLBACK_PASSED"

func TestPGPreparedMarchCreateRollbackPanic(t *testing.T) {
	if os.Getenv(marchRollbackChild) == "1" {
		runPreparedMarchRollbackChild(t)
		return
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned PG17 required")
	}
	binary, err := os.Executable()
	returnPGOK(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, binary, "-test.run=^TestPGPreparedMarchCreateRollbackPanic$", "-test.timeout=25s")
	cmd.Env = append(os.Environ(), marchRollbackChild+"=1")
	cmd.WaitDelay = time.Second
	out, childErr := cmd.CombinedOutput()
	var schema string
	seen := 0
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, marchRollbackSchema) {
			returnPGOK(t, json.Unmarshal([]byte(strings.TrimPrefix(line, marchRollbackSchema)), &schema))
			seen++
		}
	}
	if seen == 1 && strings.HasPrefix(schema, "api_return_") {
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		admin, err := pgx.Connect(clean, dsn)
		returnPGOK(t, err)
		defer func() { returnPGOK(t, admin.Close(clean)) }()
		returnPGExec(t, clean, admin, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
	}
	if childErr != nil || ctx.Err() != nil || seen != 1 || !strings.HasPrefix(schema, "api_return_") ||
		strings.Count(string(out), marchRollbackPassed+"\n") != 1 || strings.Contains(string(out), "WARNING: DATA RACE") {
		t.Fatalf("prepared create rollback child failed: %v / %v\n%s", childErr, ctx.Err(), out)
	}
}

func runPreparedMarchRollbackChild(t *testing.T) {
	trace := &preparedMarchRollbackTrace{fault: errors.New("prepared march rollback panic")}
	var owned returnBackendSet
	f := newPreparedMarchPG(t, trace, owned.configure)
	// A pgx pool slot interrupted by a panic cannot be reused. The parent reaps
	// the isolated child process and drops the recorded schema.
	defer func() {
		if fault := recover(); fault != nil {
			fmt.Fprintf(os.Stderr, "prepared march child panic: %v\n", fault)
		}
		os.Exit(1)
	}()
	schema, err := json.Marshal(f.profile.SchemaName)
	returnPGOK(t, err)
	fmt.Println(marchRollbackSchema + string(schema))
	returnPGExec(t, f.ctx, f.observer, "ALTER TABLE army_troop ADD CONSTRAINT reject_deploy CHECK (unit_cfg_id<>1)")
	var caught any
	func() {
		defer func() { caught = recover() }()
		_, _ = f.request(f.ctx, "owner", 4, 1)
	}()
	trace.armed = false
	backend := owned.get(trace.pid)
	if caught != trace.fault || !trace.bounded || backend == nil || trace.pid == f.observer.PgConn().PID() {
		t.Fatal("the expected bounded cleanup panic did not occur on an owned backend", caught, trace.pid)
	}
	storeRejected := false
	for _, event := range trace.events() {
		var pgErr *pgconn.PgError
		if event.pid == trace.pid && errors.As(event.err, &pgErr) && pgErr.Code == "23514" && pgErr.ConstraintName == "reject_deploy" {
			storeRejected = true
		}
	}
	var active bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND state='idle in transaction (aborted)')", trace.pid, backend.started).Scan(&active))
	if !storeRejected || !active {
		t.Fatal("rollback panic did not follow the real storage rejection", storeRejected, active)
	}
	recruitLifetimeState(t, f.g, 1, true, false)
	count := len(trace.events())
	reply, err := f.request(f.ctx, "owner", 4, 1)
	returnPGOK(t, err)
	assertPreparedMarchUnavailable(t, reply)
	if len(trace.events()) != count || f.s.military.March(1) != nil {
		t.Fatal("a fenced caller reached PostgreSQL or published the order")
	}
	returnPGOK(t, backend.close())
	clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	owned.noLocks(t, clean, f.observer, trace.pid, f.profile.SchemaOID)
	returnPGReleased(t, clean, f.observer, f.profile)
	if ready, orders, status, force := f.stock(); ready != 11 || orders != 0 ||
		status != hero.StatusMarch || force != f.maxForce-hero.MarchForceMarchCost {
		t.Fatal("expected original ready stock, no order and one retained HERO claim", ready, orders, status, force)
	}
	fresh := march.NewHub(nil)
	restored, err := f.restore.Restore(f.ctx, fresh)
	returnPGOK(t, err)
	if len(restored.Marches) != 0 || len(restored.Release) != 1 || restored.Release[0].HeroID != 11 {
		t.Fatal("startup did not find exactly the retained claim", restored)
	}
	fmt.Println(marchRollbackPassed)
	os.Exit(0)
}
