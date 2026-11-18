package hero

import (
	"context"
	"errors"
	"testing"
)

type orphanTestStore struct {
	Store
	fail    error
	calls   int
	recover bool
}

func (s *orphanTestStore) releaseMarchOrphan(context.Context, string, PlayerRef, int64) error {
	s.calls++
	if s.recover && s.calls == 2 {
		return nil
	}
	return s.fail
}

func TestReleaseMarchOrphanRetry(t *testing.T) {
	transient := errors.New("store failed")
	for _, tc := range []struct {
		name    string
		fail    error
		recover bool
		want    error
		calls   int
	}{
		{"retry succeeds", transient, true, nil, 2},
		{"retry fails", transient, false, transient, 2},
		{"absent", ErrHeroNotFound, false, ErrHeroNotFound, 1},
		{"linked", ErrMarchOrphanLinked, false, ErrMarchOrphanLinked, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService()
			store := &orphanTestStore{fail: tc.fail, recover: tc.recover}
			svc.UseStore(store)
			err := svc.ReleaseMarchOrphan(context.Background(), "source", PlayerRef{ServerID: 1, PlayerID: 7}, 11)
			if !errors.Is(err, tc.want) || store.calls != tc.calls {
				t.Fatalf("err=%v calls=%d", err, store.calls)
			}
		})
	}
}
