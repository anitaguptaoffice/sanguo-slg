package world

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

type chunkAtomicTx struct {
	// Any unexpected method call fails rather than silently succeeding.
	pgx.Tx

	t                   *testing.T
	ctx                 context.Context
	batch               *pgx.Batch
	calls               []string
	batchErr, commitErr error
	cancelBeforeCommit  context.CancelFunc
}

type chunkAtomicResults struct {
	pgx.BatchResults
	tx *chunkAtomicTx
}

func (tx *chunkAtomicTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults {
	if ctx != tx.ctx {
		tx.t.Error("batch did not use caller context")
	}
	tx.batch = b
	tx.calls = append(tx.calls, "batch")
	return &chunkAtomicResults{tx: tx}
}

func (r *chunkAtomicResults) Close() error {
	r.tx.calls = append(r.tx.calls, "close")
	if r.tx.cancelBeforeCommit != nil {
		r.tx.cancelBeforeCommit()
	}
	return r.tx.batchErr
}

func (tx *chunkAtomicTx) Commit(ctx context.Context) error {
	if ctx != tx.ctx {
		tx.t.Error("commit did not use caller context")
	}
	tx.calls = append(tx.calls, "commit")
	return tx.commitErr
}

func (tx *chunkAtomicTx) Rollback(ctx context.Context) error {
	tx.calls = append(tx.calls, "rollback")
	deadline, ok := ctx.Deadline()
	if ctx == tx.ctx || ctx.Err() != nil || !ok || time.Until(deadline) > 5*time.Second {
		tx.t.Error("cleanup needs an independent live context bounded to five seconds")
	}
	return errors.New("cleanup must not replace the original result")
}

func TestSaveChunkEmptyNoPool(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	for _, cells := range [][]Cell{nil, {}} {
		if err := (&PGStore{}).SaveChunk(ctx, 7, cells); err != nil {
			t.Fatal(err)
		}
	}
}

func TestSaveChunkTransactionLifecycle(t *testing.T) {
	batchErr, commitErr := errors.New("original batch error"), errors.New("unknown commit outcome")
	for _, tc := range []struct {
		name                string
		batchErr, commitErr error
		want                error
		calls               []string
	}{
		{"success", nil, nil, nil, []string{"batch", "close", "commit", "rollback"}},
		{"batch failure", batchErr, nil, batchErr, []string{"batch", "close", "rollback"}},
		{"commit failure", nil, commitErr, commitErr, []string{"batch", "close", "commit", "rollback"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			tx := &chunkAtomicTx{t: t, ctx: ctx, batchErr: tc.batchErr, commitErr: tc.commitErr, cancelBeforeCommit: cancel}
			if err := saveChunkTransaction(ctx, tx, 9, []Cell{{X: 4, Y: 5}}); err != tc.want {
				t.Fatalf("original result replaced: got %v want %v", err, tc.want)
			}
			if !reflect.DeepEqual(tx.calls, tc.calls) {
				t.Fatalf("unexpected transaction lifecycle or retry: %v", tx.calls)
			}
		})
	}
}

func TestSaveChunkBatchPreservesInput(t *testing.T) {
	ctx := context.Background()
	tx := &chunkAtomicTx{t: t, ctx: ctx}
	cells := []Cell{
		{X: 501, Y: -1, Terrain: TerrainPlain, ResourceType: 3, ResourceLevel: 4},
		{X: 501, Y: -1, Terrain: TerrainMountain, ResourceLevel: 5},
		{X: 9, Y: 2, Terrain: TerrainWater, ResourceType: 2, ResourceLevel: 1},
	}
	before := append([]Cell(nil), cells...)
	if err := saveChunkTransaction(ctx, tx, 37, cells); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cells, before) || tx.batch.Len() != len(cells) {
		t.Fatal("input changed, filtered or deduplicated")
	}
	const columns = "INSERT INTO map_cell(server_id,x,y,terrain,resource_type,resource_level)"
	const update = "ON CONFLICT(server_id,x,y) DO UPDATE SET terrain=EXCLUDED.terrain,resource_type=EXCLUDED.resource_type,resource_level=EXCLUDED.resource_level"
	for i, q := range tx.batch.QueuedQueries {
		c := cells[i]
		sql := strings.Join(strings.Fields(q.SQL), " ")
		if sql != columns+" VALUES($1,$2,$3,$4,$5,$6) "+update {
			t.Fatalf("changed upsert columns or statement semantics: %s", sql)
		}
		var rt *int16
		if c.ResourceType != 0 {
			rt = &c.ResourceType
		}
		want := []any{int32(37), c.X, c.Y, c.Terrain, rt, c.ResourceLevel}
		if !reflect.DeepEqual(q.Arguments, want) {
			t.Fatalf("row %d arguments: got %#v want %#v", i, q.Arguments, want)
		}
	}
}
