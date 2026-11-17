package api_test

import (
	"context"
	"testing"
)

func TestWarmRestartPoolOwnershipPG(t *testing.T) {
	if testing.Short() {
		t.Skip("requires dedicated full-spec PostgreSQL")
	}
	shared := openWarmSpecDB(t)
	ctx := context.Background()
	first := reopenDBPool(t)
	if first == shared {
		t.Fatal("restart connection must not own the shared fixture pool")
	}
	if _, err := first.Exec(ctx, `CREATE TABLE restart_pool_witness (id integer PRIMARY KEY); INSERT INTO restart_pool_witness VALUES (42)`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := shared.Exec(ctx, `DROP TABLE restart_pool_witness`); err != nil {
			t.Error(err)
		}
	})
	first.Close()
	second := reopenDBPool(t)
	var got int
	if err := second.QueryRow(ctx, `SELECT id FROM restart_pool_witness`).Scan(&got); err != nil || got != 42 {
		t.Fatalf("restart lost committed fixture data: id=%d err=%v", got, err)
	}
	second.Close()
	if err := shared.Ping(ctx); err != nil {
		t.Fatalf("restart closed the shared fixture: %v", err)
	}
}
