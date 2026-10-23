package rank

import "sort"

// SortAndRank orders rows by score descending, then player id ascending, and assigns positions 1..n.
func SortAndRank(rows []PlayerRow, topN int) []Entry {
	if topN <= 0 {
		topN = DefaultTopN
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Score != rows[j].Score {
			return rows[i].Score > rows[j].Score
		}
		return rows[i].PlayerID < rows[j].PlayerID
	})
	if len(rows) > topN {
		rows = rows[:topN]
	}
	out := make([]Entry, len(rows))
	for i, r := range rows {
		out[i] = Entry{
			Position:    int32(i + 1),
			SubjectID:   r.PlayerID,
			DisplayName: r.DisplayName,
			Score:       r.Score,
			GuildName:   r.GuildName,
		}
	}
	return out
}
