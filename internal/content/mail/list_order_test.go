package mail

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestMemListInboxStableOrder(t *testing.T) {
	checkInboxStableOrder(t, context.Background(), NewMemStore())
}

// Both stores must satisfy the same ordering, pagination and isolation contract.
func checkInboxStableOrder(t *testing.T, ctx context.Context, store Store) {
	t.Helper()
	stamp := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	rows := []Mail{
		{ServerID: 1, PlayerID: 7, MailID: 20, Status: StatusRead, CreatedAt: stamp},
		{ServerID: 1, PlayerID: 7, MailID: 90, Status: StatusRead, CreatedAt: stamp.Add(-time.Hour)},
		{ServerID: 1, PlayerID: 7, MailID: 10, Status: StatusUnread, CreatedAt: stamp},
		{ServerID: 1, PlayerID: 7, MailID: 1, Status: StatusUnread, CreatedAt: stamp.Add(time.Hour)},
		{ServerID: 1, PlayerID: 7, MailID: 40, Status: StatusUnread, CreatedAt: stamp},
		{ServerID: 1, PlayerID: 7, MailID: 30, Status: StatusClaimed, CreatedAt: stamp},
		{ServerID: 1, PlayerID: 7, MailID: 110, Status: StatusDeleted, CreatedAt: stamp},
		{ServerID: 1, PlayerID: 8, MailID: 100, Status: StatusUnread, CreatedAt: stamp},
		{ServerID: 2, PlayerID: 7, MailID: 40, Status: StatusUnread, CreatedAt: stamp},
	}
	for _, row := range rows {
		row.MailType = TypeSystem
		row.Title = "inbox ordering fixture"
		if err := store.Insert(ctx, row); err != nil {
			t.Fatalf("insert server=%d mail=%d: %v", row.ServerID, row.MailID, err)
		}
	}
	cases := []struct {
		name     string
		serverID int32
		playerID int64
		filter   InboxFilter
		want     []int64
	}{
		{"all", 1, 7, FilterAll, []int64{1, 40, 30, 20, 10, 90}},
		{"unread", 1, 7, FilterUnread, []int64{1, 40, 10}},
		{"read-includes-claimed", 1, 7, FilterRead, []int64{30, 20, 90}},
		{"other-player", 1, 8, FilterAll, []int64{100}},
		{"other-server", 2, 7, FilterAll, []int64{40}},
		{"empty", 1, 9, FilterAll, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, limit := range []int{1, 2, 3, 0, 20} {
				t.Run(fmt.Sprintf("limit=%d", limit), func(t *testing.T) {
					pageSize := limit
					if pageSize == 0 {
						pageSize = 20
					}
					// Re-read unchanged data: map iteration and SQL tie order must
					// never duplicate or omit a mail between adjacent offset pages.
					for repeat := 0; repeat < 12; repeat++ {
						seen := make(map[int64]bool)
						for offset := 0; offset <= len(tc.want)+pageSize; offset += pageSize {
							result, err := store.ListInbox(ctx, tc.serverID, tc.playerID,
								ListQuery{Filter: tc.filter, Limit: limit, Offset: offset})
							if err != nil {
								t.Fatal(err)
							}
							end := offset + pageSize
							if end > len(tc.want) {
								end = len(tc.want)
							}
							start := offset
							if start > end {
								start = end
							}
							if result.Total != len(tc.want) || len(result.Mails) != end-start {
								t.Fatalf("repeat=%d offset=%d: total=%d size=%d; want total=%d size=%d",
									repeat, offset, result.Total, len(result.Mails), len(tc.want), end-start)
							}
							for i, row := range result.Mails {
								if row.MailID != tc.want[start+i] || row.ServerID != tc.serverID ||
									row.PlayerID != tc.playerID || row.Status == StatusDeleted || seen[row.MailID] {
									t.Fatalf("repeat=%d offset=%d index=%d: unexpected mail %+v; want id=%d",
										repeat, offset, i, row, tc.want[start+i])
								}
								seen[row.MailID] = true
							}
						}
						if len(seen) != len(tc.want) {
							t.Fatalf("omitted mail: got %d unique IDs, want %d", len(seen), len(tc.want))
						}
					}
				})
			}
		})
	}
}
