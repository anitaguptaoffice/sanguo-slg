package rank

import (
	"context"
	"fmt"
	"testing"
)

func TestSchedulerTickMultiServerAndTypes(t *testing.T) {
	store := NewMemStore()
	var calls []string
	src := FuncSource(func(_ context.Context, serverID int32, rt RankType) ([]PlayerRow, error) {
		calls = append(calls, fmtKey(serverID, rt))
		return []PlayerRow{{PlayerID: 1, Score: 1}}, nil
	})
	svc := NewService(store, src)
	sch := NewScheduler(svc, DefaultRefreshInterval)
	sch.Configure(
		[]int32{1, 2},
		[]RankType{RankPlayerPower, RankPlayerResource},
	)
	if err := sch.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []string{
		fmtKey(1, RankPlayerPower),
		fmtKey(1, RankPlayerResource),
		fmtKey(2, RankPlayerPower),
		fmtKey(2, RankPlayerResource),
	}
	if len(calls) != len(want) {
		t.Fatalf("calls=%v want %d refreshes", calls, len(want))
	}
	for i, w := range want {
		if calls[i] != w {
			t.Fatalf("call[%d]=%q want %q all=%v", i, calls[i], w, calls)
		}
	}
}

func TestNewSchedulerDefaultInterval(t *testing.T) {
	sch := NewScheduler(NewService(NewMemStore(), FuncSource(nil)), 0)
	if sch.interval != DefaultRefreshInterval {
		t.Fatalf("interval=%v want %v", sch.interval, DefaultRefreshInterval)
	}
}

func fmtKey(serverID int32, rt RankType) string {
	return fmt.Sprintf("%d:%d", serverID, rt)
}
