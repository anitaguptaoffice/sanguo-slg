package rank

import "context"

// DataSource supplies live scores for snapshot refresh (injected by api/cmd; rank does not read foreign tables).
type DataSource interface {
	ListPlayerScores(ctx context.Context, serverID int32, rankType RankType) ([]PlayerRow, error)
}

// FuncSource adapts a function to DataSource.
type FuncSource func(ctx context.Context, serverID int32, rankType RankType) ([]PlayerRow, error)

func (f FuncSource) ListPlayerScores(ctx context.Context, serverID int32, rankType RankType) ([]PlayerRow, error) {
	return f(ctx, serverID, rankType)
}
