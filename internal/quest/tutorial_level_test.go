package quest

import (
	"context"
	"errors"
	"testing"
)

type levelReadFault struct {
	Store
	err error
}

func (s levelReadFault) GetPlayerQuest(ctx context.Context, server int32, player int64, id int32) (PlayerQuestRow, bool, error) {
	if id == 1002 {
		return PlayerQuestRow{}, false, s.err
	}
	return s.Store.GetPlayerQuest(ctx, server, player, id)
}

func TestCompletedTutorialLevelIsContiguousBoundedAndReadOnly(t *testing.T) {
	ctx, actor := context.Background(), Actor{1, 19}
	for completed := int32(0); completed <= 5; completed++ {
		store, cat := NewMemStore(), authoritativeCatalog(t)
		svc := NewService(store, cat, nil, nil)
		svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
			t.Fatal("level recovery consulted facts")
			return TutorialFacts{}, nil
		})
		for id := int32(1001); id <= 1005; id++ {
			state := int16(StateCompleted)
			if id == 1001+completed {
				state = StateClaimable // Later completed rows cannot bridge this gap.
			}
			if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 19, QuestCfgID: id, State: state}); err != nil {
				t.Fatal(err)
			}
		}
		cat.byID[9999] = QuestCfg{QuestCfgID: 9999, ChainID: 100, SortInChain: 999}
		if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 19, QuestCfgID: 9999, State: StateCompleted}); err != nil {
			t.Fatal(err)
		}
		want := completed
		if want < 1 {
			want = 1
		}
		level, err := svc.CompletedTutorialLevel(ctx, actor)
		if err != nil || level != want {
			t.Fatalf("prefix=%d level=%d want=%d error=%v", completed, level, want, err)
		}
		if level, err := svc.CompletedTutorialLevel(ctx, Actor{2, 19}); err != nil || level != 1 {
			t.Fatalf("cross-server level=%d error=%v", level, err)
		}
		if completed < 5 {
			row, _, _ := store.GetPlayerQuest(ctx, 1, 19, 1001+completed)
			if row.State != StateClaimable {
				t.Fatal("level accessor mutated a quest")
			}
		}
	}
}

func TestCompletedTutorialLevelFailsClosed(t *testing.T) {
	ctx, actor := context.Background(), Actor{1, 20}
	store := NewMemStore()
	if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 20, QuestCfgID: 1001, State: StateCompleted}); err != nil {
		t.Fatal(err)
	}
	readErr := errors.New("level progress unavailable")
	for _, mode := range []string{"read_error", "missing_config", "wrong_chain", "wrong_sort"} {
		cat := authoritativeCatalog(t)
		svc := NewService(store, cat, nil, nil)
		want := ErrProgressInvalid
		switch mode {
		case "read_error":
			svc.store, want = levelReadFault{store, readErr}, readErr
		case "missing_config":
			delete(cat.byID, 1001)
			want = ErrQuestNotFound
		case "wrong_chain", "wrong_sort":
			cfg := cat.byID[1001]
			if mode == "wrong_chain" {
				cfg.ChainID = 200
			} else {
				cfg.SortInChain = 999
			}
			cat.byID[1001] = cfg
		}
		if level, err := svc.CompletedTutorialLevel(ctx, actor); level != 0 || !errors.Is(err, want) {
			t.Fatalf("%s: level=%d error=%v want=%v", mode, level, err, want)
		}
	}
}
