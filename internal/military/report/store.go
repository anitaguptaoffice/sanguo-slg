package report

import (
	"context"
	"errors"
)

// ErrNotFound is returned when a report id does not exist on the shard.
var ErrNotFound = errors.New("battle report not found")

// ErrDuplicate is returned when report_id already exists on the shard.
var ErrDuplicate = errors.New("battle report already exists")

// Store persists and queries battle reports.
type Store interface {
	Insert(ctx context.Context, rec Record) error
	Get(ctx context.Context, serverID int32, reportID int64) (Record, error)
	ListByPlayer(ctx context.Context, p ListParams) (Page, error)
}
