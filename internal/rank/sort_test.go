package rank

import "testing"

func TestSortAndRank_orderAndTieBreak(t *testing.T) {
	rows := []PlayerRow{
		{PlayerID: 3, Score: 100, DisplayName: "c"},
		{PlayerID: 1, Score: 200, DisplayName: "a"},
		{PlayerID: 2, Score: 100, DisplayName: "b"},
	}
	got := SortAndRank(rows, 10)
	if len(got) != 3 {
		t.Fatalf("len=%d", len(got))
	}
	if got[0].Position != 1 || got[0].SubjectID != 1 || got[0].Score != 200 {
		t.Fatalf("first: %+v", got[0])
	}
	if got[1].SubjectID != 2 || got[2].SubjectID != 3 {
		t.Fatalf("tie order: %+v %+v", got[1], got[2])
	}
}

func TestSortAndRank_topN(t *testing.T) {
	rows := []PlayerRow{{PlayerID: 1, Score: 1}, {PlayerID: 2, Score: 2}, {PlayerID: 3, Score: 3}}
	got := SortAndRank(rows, 2)
	if len(got) != 2 || got[0].SubjectID != 3 {
		t.Fatalf("top2: %+v", got)
	}
}
