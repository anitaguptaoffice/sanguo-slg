package quest

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGStoreQuestProgressSurviveRestart(t *testing.T) {
	pgfixture.SkipFullSpecUnderShort(t)
	pool := pgfixture.WarmPool(t)
	ctx := context.Background()

	store1 := NewPGStore(pool)
	now := time.Unix(1_700_100_000, 0).UTC()
	row := PlayerQuestRow{
		ServerID:   4,
		PlayerID:   99,
		QuestCfgID: 1001,
		State:      StateInProgress,
		Progress:   ProgressCounter{Count: 1},
		AcceptedAt: &now,
		UpdatedAt:  now,
	}
	if err := store1.UpsertPlayerQuest(ctx, row); err != nil {
		t.Fatal(err)
	}

	store2 := NewPGStore(pool)
	got, ok, err := store2.GetPlayerQuest(ctx, 4, 99, 1001)
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if got.State != StateInProgress || got.Progress.Count != 1 {
		t.Fatalf("got %+v", got)
	}
	list, err := store2.ListPlayerQuests(ctx, 4, 99)
	if err != nil || len(list) != 1 {
		t.Fatalf("list len=%d err=%v", len(list), err)
	}
}
