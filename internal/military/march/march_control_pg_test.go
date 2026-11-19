package march

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func controlPG(t *testing.T) (*ControlStore, context.Context) {
	t.Helper()
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	binding, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	var schema string
	if err := pool.QueryRow(ctx, `SELECT current_schema()`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	profile := freshsource.Profile{
		ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2},
		ClusterRef: "test", EvidenceRef: "test", DatabaseName: "test", SchemaName: schema,
		CurrentRoleName: "test", SessionRoleName: "test",
		DatabaseOID: 1, SchemaOID: 1, SchemaOwnerOID: 1, CurrentRoleOID: 1, SessionRoleOID: 1,
		ServerID: 1, Cohort: [16]byte{3},
		Objects: map[string]freshsource.ObjectIdentity{"march_order": {OID: 1, OwnerOID: 1}},
	}
	store, err := NewControlStore(ctx, binding, profile)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'mc', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_item(server_id, player_id, item_cfg_id, quantity) VALUES (1, 7, 2050, 2);
		INSERT INTO field_army(server_id, army_id, owner_player_id, x, y, status) VALUES (1, 5, 7, 10, 10, 2);
		INSERT INTO army_troop(server_id, army_id, unit_cfg_id, count) VALUES (1, 5, 1, 100);
		INSERT INTO march_order(server_id, march_id, army_id, from_x, from_y, to_x, to_y, purpose, depart_at, arrive_at, status, origin_city_id)
		VALUES (1, 9, 5, 10, 10, 20, 10, 1, now() - interval '20 seconds', now() + interval '40 seconds', 1, 3)`); err != nil {
		t.Fatal(err)
	}
	return store, ctx
}

func TestPGControlRecallAndSpeedup(t *testing.T) {
	store, ctx := controlPG(t)
	now := time.Now()

	state, err := store.Recall(ctx, 1, 7, 9, now)
	if err != nil {
		t.Fatalf("recall: %v", err)
	}
	if state.Status != ControlReturning || state.ReturnAt.Before(now.Add(15*time.Second)) {
		t.Fatalf("recall state: %+v", state)
	}
	again, err := store.Recall(ctx, 1, 7, 9, now.Add(time.Minute))
	if err != nil || !again.ReturnAt.Equal(state.ReturnAt) {
		t.Fatalf("recall not idempotent: %+v %v", again, err)
	}
	if _, err := store.Recall(ctx, 1, 8, 9, now); err == nil {
		t.Fatal("foreign recall accepted")
	}

	speedy, err := store.Speedup(ctx, 1, 7, 9, 2050, 300, now)
	if err != nil {
		t.Fatalf("speedup: %v", err)
	}
	if speedy.Status != ControlReturning || !speedy.ReturnAt.Before(state.ReturnAt) {
		t.Fatalf("speedup state: %+v", speedy)
	}
	if speedy.ReducedSec <= 0 {
		t.Fatalf("reduced %d", speedy.ReducedSec)
	}
	var quantity int32
	if err := store.binding2Query(ctx, &quantity); err != nil {
		t.Fatal(err)
	}
	if quantity != 1 {
		t.Fatalf("item quantity %d, want 1", quantity)
	}
	if _, err := store.Speedup(ctx, 1, 7, 9, 2050, 300, now); err == nil {
		t.Fatal("speedup without stock accepted")
	}
}

// binding2Query is a test-only helper to read the item row.
func (c *ControlStore) binding2Query(ctx context.Context, out *int32) error {
	txCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	owner, err := c.binding.Begin(txCtx)
	if err != nil {
		return err
	}
	defer func() { _ = owner.Rollback(txCtx) }()
	return owner.Access().Scan(txCtx, c.binding, `
		SELECT quantity FROM `+c.table("player_item")+`
		WHERE server_id = 1 AND player_id = 7 AND item_cfg_id = 2050`, nil, out)
}
