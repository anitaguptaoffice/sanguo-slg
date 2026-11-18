package api

import (
	"slices"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func TestRestoredMarchBindsAllHeroes(t *testing.T) {
	s := &Server{}
	secondary := []int64{12, 14}
	troops := []march.TroopStack{{UnitCfgID: 1, Count: 5}}
	s.recordPlayerMarchWithHeroes(PlayerContext{ServerID: 1, PlayerID: 70}, 99, 600, 11, secondary, troops)
	secondary[0], troops[0].Count = 81, 35
	binding, ok := s.lookupMarchHero(600)
	rows, total := s.listPlayerMarches(70, 99, 10, 0)
	if !ok || binding.heroID != 11 || binding.serverID != 1 || binding.playerID != 70 ||
		!slices.Equal(binding.otherHeroIDs, []int64{12, 14}) || total != 1 || rows[0].troops[0].Count != 5 {
		t.Fatalf("wrong restored march identity or alias: %+v %+v", binding, rows)
	}
}
